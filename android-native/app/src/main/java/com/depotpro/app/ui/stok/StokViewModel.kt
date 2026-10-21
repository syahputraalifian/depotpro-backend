package com.depotpro.app.ui.stok

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.depotpro.app.data.model.Product
import com.depotpro.app.data.repository.DepotRepository
import com.depotpro.app.data.repository.Load
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

sealed class StokState {
    object Loading : StokState()
    data class Success(val products: List<Product>) : StokState()
    data class Error(val message: String) : StokState()
}

class StokViewModel(private val depotRepository: DepotRepository) : ViewModel() {

    val stokState: StateFlow<StokState> = depotRepository.productsState
        .map { toState(it) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), StokState.Loading)

    private fun toState(load: Load<List<Product>>): StokState = when (load) {
        is Load.Loading -> StokState.Loading
        is Load.Failed -> StokState.Error(load.message)
        is Load.Ready -> StokState.Success(load.data)
    }

    fun loadProducts() {
        viewModelScope.launch { depotRepository.refreshProducts() }
    }

    fun refreshCloudData() {
        viewModelScope.launch {
            depotRepository.refreshProducts()
            depotRepository.refreshOrders()
        }
    }

    fun addProduct(
        name: String,
        category: String,
        price: Double,
        costPrice: Double,
        stock: Int,
        emptyGallonStock: Int,
        emptyLpgStock: Int,
        unit: String,
        reorderPoint: Int? = null,
        trackEmpty: Boolean? = null
    ) {
        viewModelScope.launch {
            depotRepository.createProduct(
                Product(
                    name = name.trim(),
                    category = category,
                    price = price,
                    costPrice = costPrice,
                    stock = stock,
                    emptyGallonStock = emptyGallonStock,
                    emptyLpgStock = emptyLpgStock,
                    unit = unit,
                    reorderPoint = reorderPoint,
                    trackEmpty = trackEmpty
                )
            )
        }
    }

    fun updateProduct(
        id: String,
        name: String,
        category: String,
        price: Double,
        costPrice: Double,
        stock: Int,
        emptyGallonStock: Int,
        emptyLpgStock: Int,
        unit: String,
        original: Product? = null,
        reorderPoint: Int? = null,
        trackEmpty: Boolean? = null
    ) {
        viewModelScope.launch {
            depotRepository.updateProduct(
                Product(
                    id = id,
                    name = name.trim(),
                    category = category,
                    price = price,
                    costPrice = costPrice,
                    stock = stock,
                    emptyGallonStock = emptyGallonStock,
                    emptyLpgStock = emptyLpgStock,
                    unit = unit,
                    reorderPoint = reorderPoint,
                    trackEmpty = trackEmpty
                ),
                original
            )
        }
    }

    fun deleteProduct(id: String) {
        viewModelScope.launch { depotRepository.deleteProduct(id) }
    }
}
