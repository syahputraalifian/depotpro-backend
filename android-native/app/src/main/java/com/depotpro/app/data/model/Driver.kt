package com.depotpro.app.data.model

import com.google.gson.annotations.SerializedName

data class Driver(
    @SerializedName("id") val id: String? = null,
    @SerializedName("name") val name: String,
    @SerializedName("phone") val phone: String? = null,
    @SerializedName("status") val status: String? = "available",
    @SerializedName("base_salary") val baseSalary: Double = 25000.0,
    @SerializedName("completed_deliveries") val completedDeliveries: Int = 0,
    @SerializedName("gallons_delivered") val gallonsDelivered: Int = 0,
    @SerializedName("lpg_delivered") val lpgDelivered: Int = 0,
    @SerializedName("gallon_commission_rate") val gallonCommissionRate: Double = 750.0,
    @SerializedName("lpg_commission_rate") val lpgCommissionRate: Double = 500.0,
    @SerializedName("fuel_allowance") val fuelAllowance: Double = 10000.0,
    @SerializedName("deductions") val deductions: Double = 0.0,
    @SerializedName("last_paid_at") val lastPaidAt: String? = null
) {
    val gallonIncentive: Double
        get() = gallonsDelivered * gallonCommissionRate

    val lpgIncentive: Double
        get() = lpgDelivered * lpgCommissionRate

    val totalIncentive: Double
        get() = gallonIncentive + lpgIncentive

    val takeHomePay: Double
        get() = baseSalary + totalIncentive + fuelAllowance - deductions
}

data class Customer(
    @SerializedName("id") val id: String? = null,
    @SerializedName("name") val name: String,
    @SerializedName("phone") val phone: String? = null,
    @SerializedName("address") val address: String? = null,
    @SerializedName("deposit") val deposit: Double? = null
)

data class DailySaleDto(
    @SerializedName("day") val day: String = "",
    @SerializedName("date") val date: String? = null,
    @SerializedName("amount") val amount: Double = 0.0
)

data class DashboardSummary(
    @SerializedName("total_sales") val totalSales: Double = 0.0,
    @SerializedName("total_orders") val totalOrders: Int = 0,
    @SerializedName("total_products") val totalProducts: Int = 0,
    @SerializedName("gallons_sold") val gallonsSold: Int = 0,
    @SerializedName("today_sales") val todaySales: Double = 0.0,
    @SerializedName("month_sales") val monthSales: Double = 0.0,
    @SerializedName("total_hpp") val totalHpp: Double = 0.0,
    @SerializedName("total_expenses") val totalExpenses: Double = 0.0,
    @SerializedName("total_receivables") val totalReceivables: Double = 0.0,
    @SerializedName("net_profit") val netProfit: Double = 0.0,
    @SerializedName("empty_gallons") val emptyGallons: Int = 0,
    @SerializedName("empty_lpg") val emptyLpg: Int = 0,
    @SerializedName("low_stock_count") val lowStockCount: Int = 0,
    @SerializedName("daily_sales") val dailySales: List<DailySaleDto>? = null
)
