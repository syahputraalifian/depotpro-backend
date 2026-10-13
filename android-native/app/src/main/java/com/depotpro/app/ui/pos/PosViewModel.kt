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

/** Data struk setelah transaksi berhasil disimpan di server. */
data class ReceiptData(
    val order: Order,
    val paymentType: String,
    val cashPaid: Double?,
    val change: Double?
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

    private val _receipt = MutableStateFlow<ReceiptData?>(null)
    val receipt: StateFlow<ReceiptData?> = _receipt.asStateFlow()

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

    /**
     * [paymentType]: cash | transfer | qris | tempo | deposit.
     * [cashPaid] hanya untuk tunai (untuk menghitung kembalian di struk).
     */
    fun checkout(
        customer: Customer?,
        customerName: String,
        paymentType: String,
        selectedDriver: Driver?,
        cashPaid: Double?
    ) {
        val cartItems = _cart.value
        if (cartItems.isEmpty() || checkingOut) return
        checkingOut = true
        val orderId = pendingOrderId ?: UUID.randomUUID().toString().also { pendingOrderId = it }
        val method = paymentType.lowercase()

        viewModelScope.launch {
            try {
                // Harga & total dihitung ulang oleh server; nilai di sini hanya perkiraan.
                val order = Order(
                    id = orderId,
                    customerName = customer?.name ?: customerName.ifBlank { "Pelanggan Umum" },
                    items = cartItems.map {
                        OrderItem(
                            productId = it.product.id,
                            productName = it.product.name,
                            quantity = it.quantity,
                            price = it.product.price
                        )
                    },
                    totalAmount = cartItems.sumOf { it.product.price * it.quantity },
                    paymentType = method,
                    status = if (selectedDriver != null) "assigned" else "completed",
                    driverId = selectedDriver?.id,
                    driverName = selectedDriver?.name,
                    customerId = customer?.id
                )
                val saved = depotRepository.createOrder(order)
                if (saved != null) {
                    val tunai = if (method == "cash") (cashPaid ?: saved.totalAmount) else null
                    val kembali = tunai?.let { (it - saved.totalAmount).coerceAtLeast(0.0) }
                    clearCart()
                    _receipt.value = ReceiptData(saved, method, tunai, kembali)
                }
            } finally {
                checkingOut = false
            }
        }
    }

    fun dismissReceipt() {
        _receipt.value = null
    }
}
