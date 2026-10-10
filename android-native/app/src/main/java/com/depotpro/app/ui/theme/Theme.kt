package com.depotpro.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColorScheme = lightColorScheme(
    primary = WaterBluePrimary,
    onPrimary = WaterBlueOnPrimary,
    primaryContainer = WaterBlueContainer,
    onPrimaryContainer = WaterBlueOnContainer,
    secondary = LpgGreenSecondary,
    onSecondary = LpgGreenOnSecondary,
    secondaryContainer = LpgGreenContainer,
    onSecondaryContainer = LpgGreenOnContainer,
    tertiary = AccentCyan,
    background = BackgroundIceBlue,
    surface = SurfaceWhite,
    error = ErrorRed,
    errorContainer = ErrorContainerRed
)

private val DarkColorScheme = darkColorScheme(
    primary = WaterBluePrimary,
    primaryContainer = WaterBlueOnContainer,
    secondary = LpgGreenSecondary,
    secondaryContainer = LpgGreenOnContainer,
    background = BackgroundIceBlue,
    surface = SurfaceWhite
)

@Composable
fun DepotProTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}
