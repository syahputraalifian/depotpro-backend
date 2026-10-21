package com.depotpro.app.data.model

import com.google.gson.annotations.SerializedName

data class UpdateStatusRequest(
    @SerializedName("status") val status: String,
    @SerializedName("gallons_returned") val gallonsReturned: Int = 0,
    @SerializedName("lpg_returned") val lpgReturned: Int = 0
)

/** Info produk tanpa angka stok: stok diubah lewat selisih (adjust) agar tidak menimpa penjualan perangkat lain. */
data class ProductInfoBody(
    @SerializedName("name") val name: String,
    @SerializedName("category") val category: String? = null,
    @SerializedName("price") val price: Double,
    @SerializedName("cost_price") val costPrice: Double? = null,
    @SerializedName("unit") val unit: String? = null,
    @SerializedName("reorder_point") val reorderPoint: Int? = null,
    @SerializedName("track_empty") val trackEmpty: Boolean? = null
)

data class AdjustRequest(
    @SerializedName("stock_filled_delta") val stockFilledDelta: Int = 0,
    @SerializedName("stock_empty_delta") val stockEmptyDelta: Int = 0
)

data class PayRequest(
    @SerializedName("amount") val amount: Double
)

/** Bentuk respons server untuk endpoint yang membungkus hasil dalam {"success": true, "data": ...}. */
data class DataEnvelope<T>(
    @SerializedName("success") val success: Boolean? = null,
    @SerializedName("data") val data: T? = null
)

data class SimpleResponse(
    @SerializedName("success") val success: Boolean? = null,
    @SerializedName("message") val message: String? = null
)
