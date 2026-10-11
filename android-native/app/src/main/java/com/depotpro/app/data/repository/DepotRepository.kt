package com.depotpro.app.data.repository

import com.depotpro.app.data.api.ApiService
import com.depotpro.app.data.api.toUserMessage
import com.depotpro.app.data.model.AdjustRequest
import com.depotpro.app.data.model.Customer
import com.depotpro.app.data.model.DashboardSummary
import com.depotpro.app.data.model.Driver
import com.depotpro.app.data.model.Expense
import com.depotpro.app.data.model.Order
import com.depotpro.app.data.model.PayRequest
import com.depotpro.app.data.model.Product
import com.depotpro.app.data.model.ProductInfoBody
import com.depotpro.app.data.model.Receivable
import com.depotpro.app.data.model.UpdateStatusRequest
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Status pemuatan data dari server. */
sealed class Load<out T> {
    object Loading : Load<Nothing>()
    data class Ready<T>(val data: T) : Load<T>()
    data class Failed(val message: String) : Load<Nothing>()
}

fun <T> Load<List<T>>.dataOrEmpty(): List<T> = (this as? Load.Ready<List<T>>)?.data ?: emptyList()

/**
 * Repository berbasis server: server adalah satu-satunya sumber kebenaran (stok, harga, total, laporan).
 * Setiap aksi dikirim ke server dulu; data lokal hanya diperbarui dari respons/refresh server.
 */
class DepotRepository(private val api: ApiService) {

    private val _products = MutableStateFlow<Load<List<Product>>>(Load.Loading)
    private val _orders = MutableStateFlow<Load<List<Order>>>(Load.Loading)
    private val _customers = MutableStateFlow<Load<List<Customer>>>(Load.Loading)
    private val _drivers = MutableStateFlow<Load<List<Driver>>>(Load.Loading)
    private val _expenses = MutableStateFlow<Load<List<Expense>>>(Load.Loading)
    private val _receivables = MutableStateFlow<Load<List<Receivable>>>(Load.Loading)
    private val _summary = MutableStateFlow<Load<DashboardSummary>>(Load.Loading)

    val productsState: StateFlow<Load<List<Product>>> = _products.asStateFlow()
    val ordersState: StateFlow<Load<List<Order>>> = _orders.asStateFlow()
    val customersState: StateFlow<Load<List<Customer>>> = _customers.asStateFlow()
    val driversState: StateFlow<Load<List<Driver>>> = _drivers.asStateFlow()
    val expensesState: StateFlow<Load<List<Expense>>> = _expenses.asStateFlow()
    val receivablesState: StateFlow<Load<List<Receivable>>> = _receivables.asStateFlow()
    val summaryState: StateFlow<Load<DashboardSummary>> = _summary.asStateFlow()

    private val _messages = MutableSharedFlow<String>(extraBufferCapacity = 16)
    /** Pesan untuk ditampilkan ke pengguna (error/sukses). */
    val messages: SharedFlow<String> = _messages.asSharedFlow()

    @Volatile
    private var role: String? = null

    private val canSeeSummary get() = role == "owner" || role == "kasir"

    fun notify(message: String) {
        _messages.tryEmit(message)
    }

    private suspend fun <T> load(
        target: MutableStateFlow<Load<T>>,
        silent: Boolean,
        fetch: suspend () -> T
    ) {
        try {
            target.value = Load.Ready(fetch())
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            val message = e.toUserMessage()
            if (target.value is Load.Ready) {
                if (!silent) notify(message)
            } else {
                target.value = Load.Failed(message)
            }
        }
    }

    private suspend fun <T> mutate(block: suspend () -> T): T? {
        return try {
            block()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            notify(e.toUserMessage())
            null
        }
    }

    // ------------------------------------------------------------ refresh
    suspend fun refreshProducts(silent: Boolean = false) = load(_products, silent) { api.getProducts() }

    suspend fun refreshOrders(silent: Boolean = false) = load(_orders, silent) {
        api.getOrders().map { it.copy(createdAt = it.createdAtLabel ?: it.createdAt) }
    }

    suspend fun refreshCustomers(silent: Boolean = false) = load(_customers, silent) { api.getCustomers() }
    suspend fun refreshDrivers(silent: Boolean = false) = load(_drivers, silent) { api.getDrivers() }
    suspend fun refreshExpenses(silent: Boolean = false) = load(_expenses, silent) { api.getExpenses() }
    suspend fun refreshReceivables(silent: Boolean = false) = load(_receivables, silent) { api.getReceivables() }

    suspend fun refreshSummary(silent: Boolean = false) {
        if (!canSeeSummary) return
        load(_summary, silent) { api.getDashboardSummary() }
    }

    /** Muat data sesuai hak akses peran ("owner", "kasir", "gudang", "driver"). */
    suspend fun refreshAll(userRole: String, silent: Boolean = false) {
        role = userRole
        coroutineScope {
            when (userRole) {
                "owner" -> {
                    launch { refreshProducts(silent) }
                    launch { refreshOrders(silent) }
                    launch { refreshCustomers(silent) }
                    launch { refreshDrivers(silent) }
                    launch { refreshExpenses(silent) }
                    launch { refreshReceivables(silent) }
                    launch { refreshSummary(silent) }
                }
                "kasir" -> {
                    launch { refreshProducts(silent) }
                    launch { refreshOrders(silent) }
                    launch { refreshCustomers(silent) }
                    launch { refreshDrivers(silent) }
                    launch { refreshReceivables(silent) }
                    launch { refreshSummary(silent) }
                }
                "gudang" -> {
                    launch { refreshProducts(silent) }
                }
                "driver" -> {
                    launch { refreshOrders(silent) }
                    launch { refreshDrivers(silent) }
                }
            }
        }
    }

    /** Dipanggil saat logout / sesi berakhir agar data pengguna sebelumnya tidak bocor ke pengguna berikutnya. */
    fun clearAll() {
        role = null
        _products.value = Load.Loading
        _orders.value = Load.Loading
        _customers.value = Load.Loading
        _drivers.value = Load.Loading
        _expenses.value = Load.Loading
        _receivables.value = Load.Loading
        _summary.value = Load.Loading
    }

    fun currentProducts(): List<Product> = _products.value.dataOrEmpty()
    fun currentDrivers(): List<Driver> = _drivers.value.dataOrEmpty()

    // ------------------------------------------------------------- produk
    suspend fun createProduct(product: Product): Boolean {
        mutate { api.createProduct(product.copy(id = null)) } ?: return false
        notify("Produk ditambahkan")
        refreshProducts()
        return true
    }

    /**
     * [original] = produk seperti saat dialog edit dibuka. Bila diberikan, stok dikirim sebagai SELISIH
     * (atomik di server) sehingga penjualan dari perangkat lain tidak tertimpa. Tanpa [original], stok dikirim mutlak.
     */
    suspend fun updateProduct(product: Product, original: Product? = null): Boolean {
        val id = product.id ?: return false
        if (original == null) {
            mutate { api.updateProduct(id, product) } ?: return false
        } else {
            val done = mutate {
                api.updateProductInfo(
                    id,
                    ProductInfoBody(
                        name = product.name,
                        category = product.category,
                        price = product.price,
                        costPrice = product.costPrice,
                        unit = product.unit
                    )
                )
                val filledDelta = product.stock - original.stock
                val emptyDelta = (product.emptyGallonStock - original.emptyGallonStock) +
                    (product.emptyLpgStock - original.emptyLpgStock)
                if (filledDelta != 0 || emptyDelta != 0) {
                    api.adjustProductStock(id, AdjustRequest(filledDelta, emptyDelta))
                }
                Unit
            }
            if (done == null) {
                refreshProducts()
                return false
            }
        }
        notify("Produk diperbarui")
        refreshProducts()
        return true
    }

    suspend fun deleteProduct(id: String): Boolean {
        mutate { api.deleteProduct(id) } ?: return false
        notify("Produk dihapus")
        refreshProducts()
        return true
    }

    // -------------------------------------------------------------- order
    /** Mengembalikan order tersimpan (dengan id dari server) atau null bila gagal. */
    suspend fun createOrder(order: Order): Order? {
        val saved = mutate { api.createOrder(order) } ?: return null
        refreshOrders()
        refreshProducts()
        refreshSummary()
        return saved
    }

    suspend fun updateOrderStatus(orderId: String, status: String, gallonsReturned: Int, lpgReturned: Int): Boolean {
        mutate { api.updateOrderStatus(orderId, UpdateStatusRequest(status, gallonsReturned, lpgReturned)) } ?: return false
        refreshOrders()
        refreshDrivers()
        refreshProducts()
        return true
    }

    suspend fun cancelOrder(orderId: String): Boolean {
        mutate { api.deleteOrder(orderId) } ?: return false
        notify("Transaksi dibatalkan, stok dikembalikan")
        refreshOrders()
        refreshProducts()
        refreshSummary()
        refreshReceivables()
        return true
    }

    // ----------------------------------------------------------- pelanggan
    suspend fun createCustomer(customer: Customer): Boolean {
        mutate { api.createCustomer(customer.copy(id = null)) } ?: return false
        notify("Pelanggan ditambahkan")
        refreshCustomers()
        return true
    }

    suspend fun updateCustomer(customer: Customer): Boolean {
        val id = customer.id ?: return false
        mutate { api.updateCustomer(id, customer) } ?: return false
        notify("Pelanggan diperbarui")
        refreshCustomers()
        return true
    }

    suspend fun deleteCustomer(id: String): Boolean {
        mutate { api.deleteCustomer(id) } ?: return false
        notify("Pelanggan dihapus")
        refreshCustomers()
        return true
    }

    // -------------------------------------------------------------- driver
    suspend fun createDriver(driver: Driver): Boolean {
        mutate { api.createDriver(driver.copy(id = null)) } ?: return false
        notify("Driver ditambahkan")
        refreshDrivers()
        return true
    }

    suspend fun updateDriver(driver: Driver): Boolean {
        val id = driver.id ?: return false
        mutate { api.updateDriver(id, driver) } ?: return false
        notify("Driver diperbarui")
        refreshDrivers()
        return true
    }

    suspend fun deleteDriver(id: String): Boolean {
        mutate { api.deleteDriver(id) } ?: return false
        notify("Driver dihapus")
        refreshDrivers()
        return true
    }

    suspend fun payDriver(id: String): Boolean {
        mutate { api.payDriver(id) } ?: return false
        notify("Gaji driver dibayar dan dicatat sebagai pengeluaran")
        refreshDrivers()
        refreshExpenses()
        refreshSummary()
        return true
    }

    // --------------------------------------------------------- pengeluaran
    suspend fun createExpense(expense: Expense): Boolean {
        mutate { api.createExpense(expense.copy(id = null)) } ?: return false
        notify("Pengeluaran dicatat")
        refreshExpenses()
        refreshSummary()
        return true
    }

    suspend fun updateExpense(expense: Expense): Boolean {
        val id = expense.id ?: return false
        mutate { api.updateExpense(id, expense) } ?: return false
        notify("Pengeluaran diperbarui")
        refreshExpenses()
        refreshSummary()
        return true
    }

    suspend fun deleteExpense(id: String): Boolean {
        mutate { api.deleteExpense(id) } ?: return false
        notify("Pengeluaran dihapus")
        refreshExpenses()
        refreshSummary()
        return true
    }

    // ------------------------------------------------------------- piutang
    suspend fun createReceivable(receivable: Receivable): Boolean {
        mutate { api.createReceivable(receivable.copy(id = null)) } ?: return false
        notify("Piutang dicatat")
        refreshReceivables()
        refreshSummary()
        return true
    }

    suspend fun updateReceivable(receivable: Receivable): Boolean {
        val id = receivable.id ?: return false
        mutate { api.updateReceivable(id, receivable) } ?: return false
        notify("Piutang diperbarui")
        refreshReceivables()
        refreshSummary()
        return true
    }

    suspend fun payReceivable(id: String, amount: Double): Boolean {
        mutate { api.payReceivable(id, PayRequest(amount)) } ?: return false
        notify("Pembayaran piutang dicatat")
        refreshReceivables()
        refreshSummary()
        return true
    }

    suspend fun deleteReceivable(id: String): Boolean {
        mutate { api.deleteReceivable(id) } ?: return false
        notify("Piutang dihapus")
        refreshReceivables()
        refreshSummary()
        return true
    }
}
