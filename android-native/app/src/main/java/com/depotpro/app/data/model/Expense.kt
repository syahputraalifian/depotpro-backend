package com.depotpro.app.data.model

import com.google.gson.annotations.SerializedName

data class Expense(
    @SerializedName("id") val id: String? = null,
    @SerializedName("category") val category: String,
    @SerializedName("amount") val amount: Double,
    @SerializedName("date") val date: String? = null,
    @SerializedName("note") val note: String? = null
)

data class Receivable(
    @SerializedName("id") val id: String? = null,
    @SerializedName("customer_name") val customerName: String,
    @SerializedName("total_amount") val totalAmount: Double,
    @SerializedName("paid_amount") val paidAmount: Double,
    @SerializedName("status") val status: String? = "unpaid",
    @SerializedName("due_date") val dueDate: String? = null
)
