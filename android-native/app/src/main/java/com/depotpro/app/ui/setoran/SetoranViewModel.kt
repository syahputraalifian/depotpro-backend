package com.depotpro.app.ui.setoran

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.depotpro.app.data.model.CashOutstanding
import com.depotpro.app.data.model.SettlementItem
import com.depotpro.app.data.repository.DepotRepository
import com.depotpro.app.data.repository.Load
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

sealed class SetoranState {
    object Loading : SetoranState()
    data class Success(val outstanding: List<CashOutstanding>, val settlements: List<SettlementItem>) : SetoranState()
    data class Error(val message: String) : SetoranState()
}

class SetoranViewModel(private val depotRepository: DepotRepository) : ViewModel() {

    val state: StateFlow<SetoranState> = combine(
        depotRepository.outstandingState,
        depotRepository.settlementsState
    ) { outstanding, settlements ->
        toState(outstanding, settlements)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), SetoranState.Loading)

    private fun toState(
        outstanding: Load<List<CashOutstanding>>,
        settlements: Load<List<SettlementItem>>
    ): SetoranState = when {
        outstanding is Load.Failed -> SetoranState.Error(outstanding.message)
        settlements is Load.Failed -> SetoranState.Error(settlements.message)
        outstanding is Load.Ready && settlements is Load.Ready -> SetoranState.Success(outstanding.data, settlements.data)
        else -> SetoranState.Loading
    }

    fun load() {
        viewModelScope.launch {
            depotRepository.refreshOutstanding()
            depotRepository.refreshSettlements()
        }
    }

    /** Driver menyetor seluruh uang tunai pengirimannya. */
    fun submitOwn(note: String) {
        viewModelScope.launch {
            val saved = depotRepository.createDriverSettlement(null, note.ifBlank { null })
            if (saved != null) depotRepository.notify("Setoran dikirim, menunggu konfirmasi kasir/pemilik")
        }
    }

    /** Owner/kasir menerima uang langsung dari driver: buat setoran lalu langsung konfirmasi. */
    fun receiveDirect(driverId: String, received: Double, note: String) {
        viewModelScope.launch {
            val saved = depotRepository.createDriverSettlement(driverId, note.ifBlank { null }) ?: return@launch
            val id = saved.id ?: return@launch
            depotRepository.confirmSettlement(id, received, note.ifBlank { null })
        }
    }

    /** Koreksi uang yang diterima / catatan (khusus pemilik). */
    fun edit(id: String, received: Double, note: String) {
        viewModelScope.launch { depotRepository.editSettlement(id, received, note.ifBlank { null }) }
    }

    /** Hapus setoran; pesanan terkait kembali menjadi 'belum disetor' (khusus pemilik). */
    fun remove(id: String) {
        viewModelScope.launch { depotRepository.deleteSettlement(id) }
    }

    fun confirm(id: String, received: Double, note: String) {
        viewModelScope.launch { depotRepository.confirmSettlement(id, received, note.ifBlank { null }) }
    }
}
