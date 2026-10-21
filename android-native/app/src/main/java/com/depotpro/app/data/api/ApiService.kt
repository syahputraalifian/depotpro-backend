package com.depotpro.app.data.api

import com.depotpro.app.data.model.AdjustRequest
import com.depotpro.app.data.model.AccountCreate
import com.depotpro.app.data.model.AccountUpdate
import com.depotpro.app.data.model.AccountUser
import com.depotpro.app.data.model.AuthResponse
import com.depotpro.app.data.model.CashOutstanding
import com.depotpro.app.data.model.ClosingInfo
import com.depotpro.app.data.model.ClosingRequest
import com.depotpro.app.data.model.ConfirmSettlementRequest
import com.depotpro.app.data.model.Customer
import com.depotpro.app.data.model.DailyReport
import com.depotpro.app.data.model.DepositRequest
import com.depotpro.app.data.model.DashboardSummary
import com.depotpro.app.data.model.DataEnvelope
import com.depotpro.app.data.model.Driver
import com.depotpro.app.data.model.DriverSettlementRequest
import com.depotpro.app.data.model.Expense
import com.depotpro.app.data.model.LoginRequest
import com.depotpro.app.data.model.Order
import com.depotpro.app.data.model.PayRequest
import com.depotpro.app.data.model.Payroll
import com.depotpro.app.data.model.ProductInfoBody
import com.depotpro.app.data.model.Product
import com.depotpro.app.data.model.Receivable
import com.depotpro.app.data.model.ResetRequest
import com.depotpro.app.data.model.SettlementItem
import com.depotpro.app.data.model.SimpleResponse
import com.depotpro.app.data.model.UpdateStatusRequest
import com.depotpro.app.data.model.User
import com.google.gson.annotations.SerializedName
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

data class ChangePasswordRequest(
    @SerializedName("old_password") val oldPassword: String,
    @SerializedName("new_password") val newPassword: String
)

interface ApiService {

    // ---- Auth
    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): AuthResponse

    @POST("auth/change-password")
    suspend fun changePassword(@Body request: ChangePasswordRequest): AuthResponse

    @GET("auth/me")
    suspend fun getCurrentUser(): User

    // ---- Produk
    @GET("products")
    suspend fun getProducts(): List<Product>

    @POST("products")
    suspend fun createProduct(@Body product: Product): Product

    @PUT("products/{id}")
    suspend fun updateProduct(@Path("id") id: String, @Body product: Product): Product

    @PUT("products/{id}")
    suspend fun updateProductInfo(@Path("id") id: String, @Body body: ProductInfoBody): Product

    @POST("products/{id}/adjust")
    suspend fun adjustProductStock(@Path("id") id: String, @Body body: AdjustRequest): Product

    @DELETE("products/{id}")
    suspend fun deleteProduct(@Path("id") id: String): SimpleResponse

    // ---- Order / transaksi
    @GET("orders")
    suspend fun getOrders(@Query("limit") limit: Int): List<Order>

    @POST("orders")
    suspend fun createOrder(@Body order: Order): Order

    @PATCH("orders/{id}/status")
    suspend fun updateOrderStatus(@Path("id") id: String, @Body body: UpdateStatusRequest): Order

    @DELETE("orders/{id}")
    suspend fun deleteOrder(@Path("id") id: String): SimpleResponse

    // ---- Driver
    @GET("drivers")
    suspend fun getDrivers(): List<Driver>

    @POST("drivers")
    suspend fun createDriver(@Body driver: Driver): DataEnvelope<Driver>

    @PUT("drivers/{id}")
    suspend fun updateDriver(@Path("id") id: String, @Body driver: Driver): DataEnvelope<Driver>

    @DELETE("drivers/{id}")
    suspend fun deleteDriver(@Path("id") id: String): SimpleResponse

    @POST("drivers/{id}/pay")
    suspend fun payDriver(@Path("id") id: String): SimpleResponse

    @POST("drivers/{id}/recalculate")
    suspend fun recalculateDriver(@Path("id") id: String): SimpleResponse

    // ---- Pelanggan
    @GET("customers")
    suspend fun getCustomers(): List<Customer>

    @POST("customers")
    suspend fun createCustomer(@Body customer: Customer): DataEnvelope<Customer>

    @PUT("customers/{id}")
    suspend fun updateCustomer(@Path("id") id: String, @Body customer: Customer): DataEnvelope<Customer>

    @DELETE("customers/{id}")
    suspend fun deleteCustomer(@Path("id") id: String): SimpleResponse

    // ---- Pengeluaran
    @GET("expenses")
    suspend fun getExpenses(): List<Expense>

    @POST("expenses")
    suspend fun createExpense(@Body expense: Expense): Expense

    @PUT("expenses/{id}")
    suspend fun updateExpense(@Path("id") id: String, @Body expense: Expense): Expense

    @DELETE("expenses/{id}")
    suspend fun deleteExpense(@Path("id") id: String): SimpleResponse

    // ---- Piutang
    @GET("receivables")
    suspend fun getReceivables(): List<Receivable>

    @POST("receivables")
    suspend fun createReceivable(@Body receivable: Receivable): Receivable

    @PUT("receivables/{id}")
    suspend fun updateReceivable(@Path("id") id: String, @Body receivable: Receivable): Receivable

    @POST("receivables/{id}/pay")
    suspend fun payReceivable(@Path("id") id: String, @Body body: PayRequest): Receivable

    @DELETE("receivables/{id}")
    suspend fun deleteReceivable(@Path("id") id: String): SimpleResponse

    // ---- Laporan
    @GET("reports/summary")
    suspend fun getDashboardSummary(): DashboardSummary

    // ---- Laporan harian & tutup kasir
    @GET("reports/daily")
    suspend fun getDailyReport(): DailyReport

    @POST("closings")
    suspend fun saveClosing(@Body body: ClosingRequest): ClosingInfo

    // ---- Kelola akun (pemilik)
    @GET("users")
    suspend fun getUsers(): List<AccountUser>

    @POST("users")
    suspend fun createUser(@Body body: AccountCreate): AccountUser

    @PUT("users/{id}")
    suspend fun updateUser(@Path("id") id: String, @Body body: AccountUpdate): AccountUser

    @DELETE("users/{id}")
    suspend fun deleteUser(@Path("id") id: String): SimpleResponse

    // ---- Setoran uang driver
    @GET("settlements")
    suspend fun getSettlements(): List<SettlementItem>

    @GET("settlements/outstanding")
    suspend fun getCashOutstanding(): List<CashOutstanding>

    @POST("settlements/driver")
    suspend fun createDriverSettlement(@Body body: DriverSettlementRequest): SettlementItem

    @PATCH("settlements/{id}/confirm")
    suspend fun confirmSettlement(@Path("id") id: String, @Body body: ConfirmSettlementRequest): SettlementItem

    // ---- Riwayat gaji, koreksi setoran, tutup kasir, reset
    @GET("payrolls")
    suspend fun getPayrolls(@Query("driver_id") driverId: String): List<Payroll>

    @DELETE("payrolls/{id}")
    suspend fun undoPayroll(@Path("id") id: String): SimpleResponse

    @PATCH("settlements/{id}")
    suspend fun editSettlement(@Path("id") id: String, @Body body: ConfirmSettlementRequest): SettlementItem

    @DELETE("settlements/{id}")
    suspend fun deleteSettlement(@Path("id") id: String): SimpleResponse

    @DELETE("closings/{day}")
    suspend fun deleteClosing(@Path("day") day: String): SimpleResponse

    @POST("admin/reset-transactions")
    suspend fun resetTransactions(@Body body: ResetRequest): SimpleResponse

    // ---- Saldo deposit pelanggan
    @POST("customers/{id}/deposit")
    suspend fun adjustDeposit(@Path("id") id: String, @Body body: DepositRequest): Customer
}
