package com.depotpro.app.data.repository

import com.depotpro.app.data.api.ApiService
import com.depotpro.app.data.api.ChangePasswordRequest
import com.depotpro.app.data.model.AuthResponse
import com.depotpro.app.data.model.LoginRequest
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.firstOrNull
import retrofit2.HttpException
import java.io.IOException

class AuthRepository(
    private val apiService: ApiService,
    private val tokenManager: TokenManager
) {
    val tokenFlow: Flow<String?> = tokenManager.tokenFlow
    val roleFlow: Flow<String?> = tokenManager.roleFlow
    val userNameFlow: Flow<String?> = tokenManager.userNameFlow

    suspend fun login(email: String, password: String): AuthResponse {
        val response = apiService.login(LoginRequest(email = email.trim(), password = password))
        val user = response.user ?: throw IllegalStateException("Respons login dari server tidak lengkap")
        tokenManager.saveAuthData(response.accessToken, user.role, user.name, user.email)
        return response
    }

    /** Validasi token tersimpan saat aplikasi dibuka. Offline = sesi dipertahankan. */
    suspend fun verifySession() {
        val token = tokenManager.tokenFlow.firstOrNull()
        if (token.isNullOrBlank()) return
        try {
            val me = apiService.getCurrentUser()
            tokenManager.saveAuthData(token, me.role, me.name, me.email)
        } catch (e: HttpException) {
            if (e.code() == 401 || e.code() == 403) tokenManager.clearAuthData()
        } catch (_: IOException) {
            // tanpa koneksi: tetap login dengan data lokal
        }
    }

    suspend fun changePassword(oldPass: String, newPass: String) {
        val response = apiService.changePassword(ChangePasswordRequest(oldPass, newPass))
        // Server membatalkan token lama saat password berubah; simpan token baru.
        tokenManager.saveToken(response.accessToken)
    }

    suspend fun logout() {
        tokenManager.clearAuthData()
    }
}
