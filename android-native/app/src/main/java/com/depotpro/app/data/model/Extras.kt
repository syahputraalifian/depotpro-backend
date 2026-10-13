package com.depotpro.app.data.model

import com.google.gson.annotations.SerializedName

// ---------------- Laporan harian & tutup kasir
data class MethodTotal(
    @SerializedName("method") val method: String = "",
    @SerializedName("count") val count: Int = 0,
    @SerializedName("amount") val amount: Double = 0.0
)

data class DailyItem(
    @SerializedName("product_name") val productName: String = "",
    @SerializedName("qty") val qty: Int = 0,
    @SerializedName("amount") val amount: Double = 0.0
)

data class DailyExpense(
    @SerializedName("category") val category: String? = null,
    @SerializedName("amount") val amount: Double = 0.0,
    @SerializedName("note") val note: String? = null
)

data class ClosingInfo(
    @SerializedName("date") val date: String? = null,
    @SerializedName("expected_cash") val expectedCash: Double = 0.0,
    @SerializedName("counted_cash") val countedCash: Double = 0.0,
    @SerializedName("difference") val difference: Double = 0.0,
    @SerializedName("note") val note: String? = null,
    @SerializedName("closed_by_name") val closedByName: String? = null,
    @SerializedName("closed_at") val closedAt: String? = null
)

data class DailyReport(
    @SerializedName("date") val date: String = "",
    @SerializedName("orders_count") val ordersCount: Int = 0,
    @SerializedName("cancelled_count") val cancelledCount: Int = 0,
    @SerializedName("total_sales") val totalSales: Double = 0.0,
    @SerializedName("by_method") val byMethod: List<MethodTotal>? = null,
    @SerializedName("items_sold") val itemsSold: List<DailyItem>? = null,
    @SerializedName("expenses_total") val expensesTotal: Double = 0.0,
    @SerializedName("expenses") val expenses: List<DailyExpense>? = null,
    @SerializedName("receivable_payments_total") val receivablePaymentsTotal: Double = 0.0,
    @SerializedName("receivable_payments_cash") val receivablePaymentsCash: Double = 0.0,
    @SerializedName("cash_sales") val cashSales: Double = 0.0,
    @SerializedName("drawer_cash_sales") val drawerCashSales: Double = 0.0,
    @SerializedName("delivery_cash_sales") val deliveryCashSales: Double = 0.0,
    @SerializedName("driver_settlements_received") val driverSettlementsReceived: Double = 0.0,
    @SerializedName("driver_cash_outstanding") val driverCashOutstanding: Double = 0.0,
    @SerializedName("expected_cash") val expectedCash: Double = 0.0,
    @SerializedName("closing") val closing: ClosingInfo? = null
)

data class ClosingRequest(
    @SerializedName("date") val date: String? = null,
    @SerializedName("counted_cash") val countedCash: Double,
    @SerializedName("note") val note: String? = null
)

// ---------------- Kelola akun (khusus pemilik)
data class AccountUser(
    @SerializedName("id") val id: String? = null,
    @SerializedName("email") val email: String = "",
    @SerializedName("name") val name: String = "",
    @SerializedName("role") val role: String = "",
    @SerializedName("active") val active: Boolean? = true,
    @SerializedName("driver_id") val driverId: String? = null
)

data class AccountCreate(
    @SerializedName("email") val email: String,
    @SerializedName("name") val name: String,
    @SerializedName("password") val password: String,
    @SerializedName("role") val role: String,
    @SerializedName("driver_id") val driverId: String? = null
)

/** driverId "" = lepaskan tautan driver; null = tidak diubah. */
data class AccountUpdate(
    @SerializedName("name") val name: String? = null,
    @SerializedName("role") val role: String? = null,
    @SerializedName("active") val active: Boolean? = null,
    @SerializedName("password") val password: String? = null,
    @SerializedName("driver_id") val driverId: String? = null
)

// ---------------- Setoran uang driver
data class CashOutstanding(
    @SerializedName("driver_id") val driverId: String = "",
    @SerializedName("driver_name") val driverName: String? = null,
    @SerializedName("amount") val amount: Double = 0.0,
    @SerializedName("orders") val orders: Int = 0
)

data class SettlementItem(
    @SerializedName("id") val id: String? = null,
    @SerializedName("driver_id") val driverId: String? = null,
    @SerializedName("driver_name") val driverName: String? = null,
    @SerializedName("user_name") val userName: String? = null,
    @SerializedName("amount") val amount: Double = 0.0,
    @SerializedName("order_count") val orderCount: Int = 0,
    @SerializedName("status") val status: String? = null,
    @SerializedName("note") val note: String? = null,
    @SerializedName("received_amount") val receivedAmount: Double? = null,
    @SerializedName("difference") val difference: Double? = null,
    @SerializedName("created_at") val createdAt: String? = null,
    @SerializedName("confirmed_at") val confirmedAt: String? = null,
    @SerializedName("confirmed_by_name") val confirmedByName: String? = null
)

data class DriverSettlementRequest(
    @SerializedName("driver_id") val driverId: String? = null,
    @SerializedName("note") val note: String? = null
)

data class ConfirmSettlementRequest(
    @SerializedName("received_amount") val receivedAmount: Double? = null,
    @SerializedName("note") val note: String? = null
)
