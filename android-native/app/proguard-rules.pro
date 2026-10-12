# Aturan R8/ProGuard untuk DepotPro (build rilis)

# Gson membaca field lewat refleksi + @SerializedName: JANGAN diacak/dihapus.
-keepattributes Signature, *Annotation*, InnerClasses, EnclosingMethod
-keep class com.depotpro.app.data.model.** { *; }
-keep class com.depotpro.app.data.api.ChangePasswordRequest { *; }
-keep class com.depotpro.app.data.api.ApiService { *; }

# Retrofit: tipe generik pada suspend function
-keep,allowobfuscation,allowshrinking class kotlin.coroutines.Continuation
-keep,allowobfuscation,allowshrinking class retrofit2.Response
-dontwarn retrofit2.KotlinExtensions
-dontwarn retrofit2.KotlinExtensions$*

# OkHttp / Okio
-dontwarn okhttp3.internal.platform.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**

# Gson
-keep class com.google.gson.reflect.TypeToken { *; }
-keep class * extends com.google.gson.reflect.TypeToken
