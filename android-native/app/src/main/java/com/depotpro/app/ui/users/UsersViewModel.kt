package com.depotpro.app.ui.users

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.depotpro.app.data.model.AccountUpdate
import com.depotpro.app.data.model.AccountUser
import com.depotpro.app.data.model.Driver
import com.depotpro.app.data.repository.DepotRepository
import com.depotpro.app.data.repository.Load
import com.depotpro.app.data.repository.dataOrEmpty
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

sealed class UsersState {
    object Loading : UsersState()
    data class Success(val users: List<AccountUser>, val drivers: List<Driver>) : UsersState()
    data class Error(val message: String) : UsersState()
}

class UsersViewModel(private val depotRepository: DepotRepository) : ViewModel() {

    val state: StateFlow<UsersState> = combine(
        depotRepository.usersState,
        depotRepository.driversState
    ) { users, drivers ->
        toState(users, drivers)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), UsersState.Loading)

    private fun toState(users: Load<List<AccountUser>>, drivers: Load<List<Driver>>): UsersState = when (users) {
        is Load.Loading -> UsersState.Loading
        is Load.Failed -> UsersState.Error(users.message)
        is Load.Ready -> UsersState.Success(users.data, drivers.dataOrEmpty())
    }

    fun load() {
        viewModelScope.launch {
            depotRepository.refreshUsers()
            depotRepository.refreshDrivers()
        }
    }

    fun create(email: String, name: String, password: String, role: String, driverId: String?) {
        viewModelScope.launch { depotRepository.createUser(email, name, password, role, driverId) }
    }

    /** driverId: "" = lepas tautan; null = tidak diubah. */
    fun update(id: String, name: String, role: String, driverId: String?) {
        viewModelScope.launch {
            depotRepository.updateUser(id, AccountUpdate(name = name.trim(), role = role, driverId = driverId))
        }
    }

    fun setActive(id: String, active: Boolean) {
        viewModelScope.launch { depotRepository.updateUser(id, AccountUpdate(active = active)) }
    }

    fun resetPassword(id: String, password: String) {
        viewModelScope.launch { depotRepository.updateUser(id, AccountUpdate(password = password)) }
    }

    /** Hapus permanen semua riwayat transaksi (harus mengetik konfirmasi). */
    fun resetTransactions(confirm: String) {
        viewModelScope.launch { depotRepository.resetTransactions(confirm) }
    }

    fun delete(id: String) {
        viewModelScope.launch { depotRepository.deleteUser(id) }
    }
}
