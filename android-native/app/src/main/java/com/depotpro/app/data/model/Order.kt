package com.depotpro.app.data.model

import com.google.gson.annotations.SerializedName

data class OrderItem(
    @SerializedName("product_id") val productId: String? = null,
    @SerializedName("product_name") val productName: String,
    @SerializedName("quantity") val quantity: Int,
    @SerializedName("price") val price: Double
)

data class Order(
    @SerializedName("id") val id: String? = null,
    @SerializedName("customer_name") val customerName: String? = null,
    @SerializedName("items") val items: List<OrderItem> = emptyList(),
    @SerializedName("total_amount") val totalAmount: Double,
    @SerializedName("payment_type") val paymentType: String? = "cash",
    @SerializedName("status") val status: String? = "pending",
    @SerializedName("driver_id") val driverId: String? = null,
    @SerializedName("driver_name") val driverName: String? = null,
    // Waktu mentah dari server tidak dikirim balik; repository mengisi ini dengan label WIB yang mudah dibaca.
    @SerializedName("created_at") val createdAt: String? = null,
    @SerializedName("customer_id") val customerId: String? = null,
    @SerializedName("created_at_label") val createdAtLabel: String? = null
) {
    /** Order pengantaran yang masih berjalan atau sudah selesai (bukan penjualan langsung di toko). */
    val isDelivery: Boolean
        get() = status == "pending" || status == "assigned" || status == "on_delivery" || status == "delivered"
}
