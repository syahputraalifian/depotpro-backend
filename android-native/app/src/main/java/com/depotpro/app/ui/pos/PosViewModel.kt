package com.depotpro.app.ui.pos

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.depotpro.app.data.model.Customer
import com.depotpro.app.data.model.Driver
import com.depotpro.app.data.model.Order
import com.depotpro.app.data.model.OrderItem
import com.depotpro.app.data.model.Product
import com.depotpro.app.data.repository.DepotRepository
import com.depotpro.app.data.repository.Load
import com.depotpro.app.data.repository.dataOrEmpty
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.util.UUID

data class CartItem(
    val product: Product,
    var quantity: Int
)

sealed class PosState {
    object Loading : PosState()
    data class Success(
        val products: List<Product>,
        val drivers: List<Driver>,
        val customers: List<Customer>
    ) : PosState()
    data class Error(val message: String) : PosState()
}

class PosViewModel(private val depotRepository: DepotRepository) : ViewModel() {

    val posState: StateFlow<PosState> = combine(
        depotRepository.productsState,
        depotRepository.driversState,
        depotRepository.customersState
    ) { products, drivers, customers ->
        toState(products, drivers, customers)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), PosState.Loading)

    private fun toState(
        products: Load<List<Product>>,
        drivers: Load<List<Driver>>,
        customers: Load<List<Customer>>
    ): PosState = when (products) {
        is Load.Loading -> PosState.Loading
        is Load.Failed -> PosState.Error(products.message)
        is Load.Ready -> PosState.Success(products.data, drivers.dataOrEmpty(), customers.dataOrEmpty())
    }

    private val _cart = MutableStateFlow<List<CartItem>>(emptyList())
    val cart: StateFlow<List<CartItem>> = _cart.asStateFlow()

    private val _checkoutSuccess = MutableStateFlow(false)
    val checkoutSuccess: StateFlow<Boolean> = _checkoutSuccess.asStateFlow()

    // Kunci idempotensi: bila request pertama sukses tetapi respons hilang, mencoba lagi tidak membuat penjualan ganda.
    private var pendingOrderId: String? = null
    private var checkingOut = false

    fun addToCart(product: Product) {
        val current = _cart.value.toMutableList()
        val index = current.indexOfFirst { it.product.id == product.id }
        if (index >= 0) {
            val existing = current[index]
            if (existing.quantity < product.stock) {
                current[index] = existing.copy(quantity = existing.quantity + 1)
            }
        } else if (product.stock > 0) {
            current.add(CartItem(product = product, quantity = 1))
        }
        _cart.value = current
        pendingOrderId = null
    }

    fun removeFromCart(product: Product) {
        val current = _cart.value.toMutableList()
        val index = current.indexOfFirst { it.product.id == product.id }
        if (index >= 0) {
            val existing = current[index]
            if (existing.quantity > 1) {
                current[index] = existing.copy(quantity = existing.quantity - 1)
            } else {
                current.removeAt(index)
            }
        }
        _cart.value = current
        pendingOrderId = null
    }

    fun clearCart() {
        _cart.value = emptyList()
        pendingOrderId = null
    }

    fun checkout(customerName: String, paymentType: String, selectedDriver: Driver?) {
        val cartItems = _cart.value
        if (cartItems.isEmpty() || checkingOut) return
        checkingOut = true
        val orderId = pendingOrderId ?: UUID.randomUUID().toString().also { pendingOrderId = it }

        viewModelScope.launch {
            try {
                // Harga & total dihitung ulang oleh server; nilai di sini hanya perkiraan tampilan.
                val order = Order(
                    id = orderId,
                    customerName = customerName.ifBlank { "Pelanggan Umum" },
                    items = cartItems.map {
                        OrderItem(
                            productId = it.product.id,
                            productName = it.product.name,
                            quantity = it.quantity,
                            price = it.product.price
                        )
                    },
                    totalAmount = cartItems.sumOf { it.product.price * it.quantity },
                    paymentType = paymentType.lowercase(),
                    status = if (selectedDriver != null) "assigned" else "completed",
                    driverId = selectedDriver?.id,
                    driverName = selectedDriver?.name
                )
                val saved = depotRepository.createOrder(order)
                if (saved != null) {
                    clearCart()
                    _checkoutSuccess.value = true
                }
            } finally {
                checkingOut = false
            }
        }
    }

    fun resetCheckoutState() {
        _checkoutSuccess.value = false
    }
}
