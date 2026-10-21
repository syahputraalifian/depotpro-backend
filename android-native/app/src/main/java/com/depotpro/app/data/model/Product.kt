package com.depotpro.app.data.model

import com.google.gson.annotations.SerializedName

data class Product(
    @SerializedName("id") val id: String? = null,
    @SerializedName("name") val name: String,
    @SerializedName("category") val category: String? = null,
    @SerializedName("price") val price: Double = 0.0,
    @SerializedName("cost_price") val costPrice: Double? = 0.0,
    @SerializedName("stock") val stock: Int = 0,
    @SerializedName("empty_gallon_stock") val emptyGallonStock: Int = 0,
    @SerializedName("empty_lpg_stock") val emptyLpgStock: Int = 0,
    @SerializedName("unit") val unit: String? = "pcs",
    // Null = tidak dikirim ke server, sehingga nilai di server tidak tertimpa saat edit.
    @SerializedName("reorder_point") val reorderPoint: Int? = null,
    @SerializedName("total_sold") val totalSold: Int? = null,
    // false = produk ini tidak menambah stok wadah kosong saat terjual (mis. AMDK dus). Null = tidak diubah.
    @SerializedName("track_empty") val trackEmpty: Boolean? = null
) {
    val marginPercentage: Double
        get() = if (price > 0 && (costPrice ?: 0.0) > 0) {
            ((price - (costPrice ?: 0.0)) / price) * 100
        } else 0.0
}
