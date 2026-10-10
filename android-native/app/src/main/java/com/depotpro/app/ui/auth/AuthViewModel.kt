package com.depotpro.app.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.depotpro.app.data.api.SessionEvents
import com.depotpro.app.data.api.toUserMessage
import com.depotpro.app.data.model.User
import com.depotpro.app.data.repository.AuthRepository
import com.depotpro.app.data.repository.DepotRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

sealed class AuthState {
    object Idle : AuthState()
    object Loading : AuthState()
    data class Success(val user: User?, val role: String) : AuthState()
    data class Error(val message: String) : AuthState()
}

sealed class Session {
    object Loading : Session()
    object LoggedOut : Session()
    data class LoggedIn(val role: String) : Session()
}

/** Peran backend (owner/cashier/warehouse_admin/driver) -> peran yang dipakai UI (owner/kasir/gudang/driver). */
fun toUiRole(role: String?): String? = when (role?.trim()?.lowercase()) {
    "owner", "pemilik" -> "owner"
    "cashier", "kasir" -> "kasir"
    "warehouse_admin", "warehouse", "gudang" -> "gudang"
    "driver", "kurir" -> "driver"
    else -> null
}

class AuthViewModel(
    private val authRepository: AuthRepository,
    private val depotRepository: DepotRepository
) : ViewModel() {

    private val _authState = MutableStateFlow<AuthState>(AuthState.Idle)
    val authState: StateFlow<AuthState> = _authState.asStateFlow()

    val session: StateFlow<Session> = combine(authRepository.tokenFlow, authRepository.roleFlow) { token, role ->
        computeSession(token, role)
    }.stateIn(viewModelScope, SharingStarted.Eagerly, Session.Loading)

    /** Peran UI saat ini; null bila belum login. */
    val userRole: StateFlow<String?> = session
        .map { (it as? Session.LoggedIn)?.role }
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)

    init {
        viewModelScope.launch { authRepository.verifySession() }
        viewModelScope.launch {
            SessionEvents.expired.collect {
                depotRepository.clearAll()
                depotRepository.notify("Sesi berakhir, silakan login kembali.")
            }
        }
    }

    private fun computeSession(token: String?, role: String?): Session {
        val uiRole = toUiRole(role)
        return if (token.isNullOrBlank() || uiRole == null) Session.LoggedOut else Session.LoggedIn(uiRole)
    }

    fun login(email: String, pass: String) {
        if (email.isBlank() || pass.isEmpty()) {
            _authState.value = AuthState.Error("Email dan Password wajib diisi!")
            return
        }
        if (_authState.value is AuthState.Loading) return
        viewModelScope.launch {
            _authState.value = AuthState.Loading
            try {
                val response = authRepository.login(email, pass)
                val role = toUiRole(response.user?.role)
                if (role == null) {
                    authRepository.logout()
                    _authState.value = AuthState.Error("Role akun tidak dikenali.")
                } else {
                    _authState.value = AuthState.Success(response.user, role)
                }
            } catch (e: Exception) {
                _authState.value = AuthState.Error(e.toUserMessage())
            }
        }
    }

    /** Hasil dikembalikan lewat [onResult] (sukses?, pesan) setelah server menjawab. */
    fun changePassword(oldPass: String, newPass: String, onResult: (Boolean, String) -> Unit) {
        if (newPass.length < 6) {
            onResult(false, "Password baru minimal 6 karakter")
            return
        }
        viewModelScope.launch {
            try {
                authRepository.changePassword(oldPass, newPass)
                onResult(true, "Password berhasil diperbarui")
            } catch (e: Exception) {
                onResult(false, e.toUserMessage())
            }
        }
    }

    fun resetState() {
        _authState.value = AuthState.Idle
    }

    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
            depotRepository.clearAll()
            _authState.value = AuthState.Idle
        }
    }
}
