package com.depotpro.app.data.repository

import com.depotpro.app.data.api.ApiService
import com.depotpro.app.data.api.toUserMessage
import com.depotpro.app.data.model.AccountCreate
import com.depotpro.app.data.model.AccountUpdate
import com.depotpro.app.data.model.AccountUser
import com.depotpro.app.data.model.AdjustRequest
import com.depotpro.app.data.model.DepositRequest
import com.depotpro.app.data.model.FailedOrder
import com.depotpro.app.data.model.CashOutstanding
import com.depotpro.app.data.model.ConfirmSettlementRequest
import com.depotpro.app.data.model.DriverSettlementRequest
import com.depotpro.app.data.model.SettlementItem
import com.depotpro.app.data.model.ClosingRequest
import com.depotpro.app.data.model.Customer
import com.depotpro.app.data.model.DailyReport
import com.depotpro.app.data.model.DashboardSummary
import com.depotpro.app.data.model.Driver
import com.depotpro.app.data.model.Expense
import com.depotpro.app.data.model.Order
import com.depotpro.app.data.model.PayRequest
import com.depotpro.app.data.model.Payroll
import com.depotpro.app.data.model.Product
import com.depotpro.app.data.model.ProductInfoBody
import com.depotpro.app.data.model.Receivable
import com.depotpro.app.data.model.ResetRequest
import com.depotpro.app.data.model.UpdateStatusRequest
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import retrofit2.HttpException
import java.io.IOException

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
/** Hasil penjualan: [queued] = true bila disimpan di HP karena offline dan akan dikirim otomatis. */
data class SaleResult(val order: Order, val queued: Boolean)

class DepotRepository(private val api: ApiService, private val store: PendingOrderStore) {

    private val _products = MutableStateFlow<Load<List<Product>>>(Load.Loading)
    private val _orders = MutableStateFlow<Load<List<Order>>>(Load.Loading)
    private val _customers = MutableStateFlow<Load<List<Customer>>>(Load.Loading)
    private val _drivers = MutableStateFlow<Load<List<Driver>>>(Load.Loading)
    private val _expenses = MutableStateFlow<Load<List<Expense>>>(Load.Loading)
    private val _receivables = MutableStateFlow<Load<List<Receivable>>>(Load.Loading)
    private val _summary = MutableStateFlow<Load<DashboardSummary>>(Load.Loading)
    private val _daily = MutableStateFlow<Load<DailyReport>>(Load.Loading)
    private val _pendingCount = MutableStateFlow(store.pending().size)
    private val _failedOrders = MutableStateFlow(store.failed())
    private val _users = MutableStateFlow<Load<List<AccountUser>>>(Load.Loading)
    private val _settlements = MutableStateFlow<Load<List<SettlementItem>>>(Load.Loading)
    private val _outstanding = MutableStateFlow<Load<List<CashOutstanding>>>(Load.Loading)

    val productsState: StateFlow<Load<List<Product>>> = _products.asStateFlow()
    val ordersState: StateFlow<Load<List<Order>>> = _orders.asStateFlow()
    val customersState: StateFlow<Load<List<Customer>>> = _customers.asStateFlow()
    val driversState: StateFlow<Load<List<Driver>>> = _drivers.asStateFlow()
    val expensesState: StateFlow<Load<List<Expense>>> = _expenses.asStateFlow()
    val receivablesState: StateFlow<Load<List<Receivable>>> = _receivables.asStateFlow()
    val summaryState: StateFlow<Load<DashboardSummary>> = _summary.asStateFlow()
    val dailyState: StateFlow<Load<DailyReport>> = _daily.asStateFlow()
    /** Jumlah transaksi offline yang menunggu dikirim. */
    val pendingCount: StateFlow<Int> = _pendingCount.asStateFlow()
    /** Transaksi offline yang ditolak server dan perlu keputusan kasir. */
    val failedOrders: StateFlow<List<FailedOrder>> = _failedOrders.asStateFlow()

    /** Produk yang stoknya sudah di batas minimum (hanya produk yang batasnya sudah diisi). */
    val lowStockProducts: Flow<List<Product>> = _products.map { load ->
        load.dataOrEmpty().filter { (it.reorderPoint ?: 0) > 0 && it.stock <= (it.reorderPoint ?: 0) }
    }
    val usersState: StateFlow<Load<List<AccountUser>>> = _users.asStateFlow()
    val settlementsState: StateFlow<Load<List<SettlementItem>>> = _settlements.asStateFlow()
    val outstandingState: StateFlow<Load<List<CashOutstanding>>> = _outstanding.asStateFlow()

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
        api.getOrders(200).map { it.copy(createdAt = it.createdAtLabel ?: it.createdAt) }
    }

    suspend fun refreshCustomers(silent: Boolean = false) = load(_customers, silent) { api.getCustomers() }
    suspend fun refreshDrivers(silent: Boolean = false) = load(_drivers, silent) { api.getDrivers() }
    suspend fun refreshExpenses(silent: Boolean = false) = load(_expenses, silent) { api.getExpenses() }
    suspend fun refreshReceivables(silent: Boolean = false) = load(_receivables, silent) { api.getReceivables() }

    suspend fun refreshDaily(silent: Boolean = false) = load(_daily, silent) { api.getDailyReport() }
    suspend fun refreshUsers(silent: Boolean = false) = load(_users, silent) { api.getUsers() }
    suspend fun refreshSettlements(silent: Boolean = false) = load(_settlements, silent) { api.getSettlements() }
    suspend fun refreshOutstanding(silent: Boolean = false) = load(_outstanding, silent) { api.getCashOutstanding() }

    suspend fun refreshSummary(silent: Boolean = false) {
        if (!canSeeSummary) return
        load(_summary, silent) { api.getDashboardSummary() }
    }

    /**
     * Muat data sesuai hak akses peran ("owner", "kasir", "gudang", "driver").
     * [light] = hanya data yang sering berubah (stok, transaksi, ringkasan) agar hemat kuota & baterai.
     */
    suspend fun refreshAll(userRole: String, silent: Boolean = false, light: Boolean = false) {
        role = userRole
        if (userRole == "owner" || userRole == "kasir") syncPending()
        coroutineScope {
            when (userRole) {
                "owner" -> {
                    launch { refreshProducts(silent) }
                    launch { refreshOrders(silent) }
                    launch { refreshSummary(silent) }
                    launch { refreshSettlements(silent) }
                    launch { refreshOutstanding(silent) }
                    if (!light) {
                        launch { refreshCustomers(silent) }
                        launch { refreshDrivers(silent) }
                        launch { refreshExpenses(silent) }
                        launch { refreshReceivables(silent) }
                        launch { refreshUsers(silent) }
                    }
                }
                "kasir" -> {
                    launch { refreshProducts(silent) }
                    launch { refreshOrders(silent) }
                    launch { refreshSummary(silent) }
                    launch { refreshSettlements(silent) }
                    launch { refreshOutstanding(silent) }
                    if (!light) {
                        launch { refreshCustomers(silent) }
                        launch { refreshDrivers(silent) }
                        launch { refreshReceivables(silent) }
                    }
                }
                "gudang" -> {
                    launch { refreshProducts(silent) }
                }
                "driver" -> {
                    launch { refreshOrders(silent) }
                    launch { refreshDrivers(silent) }
                    launch { refreshSettlements(silent) }
                    launch { refreshOutstanding(silent) }
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
        _daily.value = Load.Loading
        _users.value = Load.Loading
        _settlements.value = Load.Loading
        _outstanding.value = Load.Loading
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
                        unit = product.unit,
                        reorderPoint = product.reorderPoint,
                        trackEmpty = product.trackEmpty
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
    /**
     * Simpan penjualan ke server. Bila internet putus, transaksi disimpan di HP dan dikirim otomatis nanti
     * (aman: id unik + server idempoten). Mengembalikan null bila server menolak (mis. stok tidak cukup).
     */
    suspend fun createOrder(order: Order): SaleResult? {
        return try {
            val saved = api.createOrder(order)
            store.removePending(order.id)
            refreshPendingState()
            refreshOrders()
            refreshProducts()
            refreshSummary()
            SaleResult(saved, false)
        } catch (e: CancellationException) {
            throw e
        } catch (e: IOException) {
            store.addPending(order)
            refreshPendingState()
            notify("Tidak ada koneksi. Transaksi disimpan di HP dan dikirim otomatis saat internet kembali.")
            SaleResult(order, true)
        } catch (e: Exception) {
            notify(e.toUserMessage())
            null
        }
    }

    private fun refreshPendingState() {
        _pendingCount.value = store.pending().size
        _failedOrders.value = store.failed()
    }

    /** Kirim ulang transaksi offline. Berhenti bila masih offline; yang ditolak server dipindah ke daftar gagal. */
    suspend fun syncPending(): Boolean {
        val list = store.pending()
        if (list.isEmpty()) return false
        var sent = 0
        for (o in list) {
            try {
                api.createOrder(o)
                store.removePending(o.id)
                sent++
            } catch (e: CancellationException) {
                throw e
            } catch (e: IOException) {
                break // masih offline
            } catch (e: HttpException) {
                if (e.code() == 401) break
                store.moveToFailed(o, e.toUserMessage())
            } catch (e: Exception) {
                store.moveToFailed(o, e.toUserMessage())
            }
        }
        refreshPendingState()
        if (sent > 0) {
            notify("$sent transaksi offline berhasil dikirim")
            refreshOrders()
            refreshProducts()
            refreshSummary()
        }
        return sent > 0
    }

    suspend fun retryFailedOrder(id: String) {
        store.retryFailed(id)
        refreshPendingState()
        syncPending()
    }

    fun discardFailedOrder(id: String) {
        store.discardFailed(id)
        refreshPendingState()
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

    /** Hitung ulang jumlah pengiriman & komisi periode berjalan dari pesanan yang sudah terkirim. */
    suspend fun recalculateDriver(id: String): Boolean {
        mutate { api.recalculateDriver(id) } ?: return false
        notify("Komisi dihitung ulang dari pengiriman")
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

    // ----------------------------------------------------- tutup kasir
    suspend fun saveClosing(countedCash: Double, note: String): Boolean {
        mutate { api.saveClosing(ClosingRequest(countedCash = countedCash, note = note.ifBlank { null })) } ?: return false
        notify("Tutup kasir tersimpan")
        refreshDaily()
        return true
    }

    // ------------------------------------------------------ kelola akun
    suspend fun createUser(email: String, name: String, password: String, role: String, driverId: String?): Boolean {
        mutate { api.createUser(AccountCreate(email.trim(), name.trim(), password, role, driverId)) } ?: return false
        notify("Akun dibuat")
        refreshUsers()
        refreshDrivers()
        return true
    }

    suspend fun updateUser(id: String, update: AccountUpdate): Boolean {
        mutate { api.updateUser(id, update) } ?: return false
        notify("Akun diperbarui")
        refreshUsers()
        refreshDrivers()
        return true
    }

    suspend fun deleteUser(id: String): Boolean {
        mutate { api.deleteUser(id) } ?: return false
        notify("Akun dihapus")
        refreshUsers()
        refreshDrivers()
        return true
    }

    // ------------------------------------------------- setoran uang driver
    /** Driver menyetor seluruh uang tunai pengiriman. Untuk owner/kasir: wajib isi [driverId]. Mengembalikan setoran tersimpan. */
    suspend fun createDriverSettlement(driverId: String?, note: String?): SettlementItem? {
        val saved = mutate { api.createDriverSettlement(DriverSettlementRequest(driverId, note)) } ?: return null
        refreshSettlements()
        refreshOutstanding()
        return saved
    }

    suspend fun confirmSettlement(id: String, receivedAmount: Double?, note: String?): Boolean {
        mutate { api.confirmSettlement(id, ConfirmSettlementRequest(receivedAmount, note)) } ?: return false
        notify("Setoran diterima")
        refreshSettlements()
        refreshOutstanding()
        refreshSummary()
        return true
    }

    // ------------------------------------------- riwayat gaji & koreksi
    suspend fun loadPayrolls(driverId: String): List<Payroll>? = mutate { api.getPayrolls(driverId) }

    suspend fun undoPayroll(id: String): Boolean {
        mutate { api.undoPayroll(id) } ?: return false
        notify("Pembayaran gaji dibatalkan")
        refreshDrivers()
        refreshExpenses()
        refreshSummary()
        return true
    }

    suspend fun editSettlement(id: String, receivedAmount: Double?, note: String?): Boolean {
        mutate { api.editSettlement(id, ConfirmSettlementRequest(receivedAmount, note)) } ?: return false
        notify("Setoran diperbarui")
        refreshSettlements()
        refreshSummary()
        return true
    }

    suspend fun deleteSettlement(id: String): Boolean {
        mutate { api.deleteSettlement(id) } ?: return false
        notify("Setoran dihapus")
        refreshSettlements()
        refreshOutstanding()
        refreshOrders()
        refreshSummary()
        return true
    }

    suspend fun deleteClosing(day: String): Boolean {
        mutate { api.deleteClosing(day) } ?: return false
        notify("Catatan tutup kasir dihapus")
        refreshDaily()
        return true
    }

    /** HAPUS PERMANEN seluruh riwayat transaksi (khusus pemilik). Produk, stok, pelanggan, dan akun tidak dihapus. */
    suspend fun resetTransactions(confirm: String): Boolean {
        mutate { api.resetTransactions(ResetRequest(confirm)) } ?: return false
        notify("Semua riwayat transaksi dihapus")
        refreshOrders()
        refreshSummary()
        refreshExpenses()
        refreshReceivables()
        refreshDrivers()
        refreshSettlements()
        refreshOutstanding()
        refreshDaily()
        refreshProducts()
        return true
    }

    // ---------------------------------------------------- saldo deposit
    /** [amount] positif = isi saldo; negatif = kurangi (khusus pemilik). */
    suspend fun adjustDeposit(customerId: String, amount: Double, reason: String?): Boolean {
        mutate { api.adjustDeposit(customerId, DepositRequest(amount, reason)) } ?: return false
        notify(if (amount >= 0) "Saldo deposit ditambah" else "Saldo deposit dikurangi")
        refreshCustomers()
        return true
    }
}
