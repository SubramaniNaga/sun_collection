package com.sunapp.mobile.overlay

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import java.io.File

class OverlayCaptureActivity : Activity() {
  private var photoFile: File? = null
  private var photoUri: Uri? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    if (!hasCamera()) {
      OverlayCameraBridge.deliverPhoto(null)
      finish()
      return
    }

    if (!hasCameraPermission()) {
      ActivityCompat.requestPermissions(this, arrayOf(android.Manifest.permission.CAMERA), REQUEST_CAMERA)
      return
    }

    launchCamera()
  }

  override fun onRequestPermissionsResult(
    requestCode: Int,
    permissions: Array<out String>,
    grantResults: IntArray,
  ) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    if (requestCode == REQUEST_CAMERA) {
      if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
        launchCamera()
      } else {
        OverlayCameraBridge.deliverPhoto(null)
        finish()
      }
    }
  }

  @Deprecated("Deprecated in API 33")
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    if (requestCode != REQUEST_CAPTURE) return

    val path =
      when {
        resultCode != RESULT_OK -> null
        photoFile?.exists() == true && (photoFile?.length() ?: 0L) > 0L -> photoFile?.absolutePath
        data?.data != null -> data.data?.toString()
        else -> null
      }

    OverlayCameraBridge.deliverPhoto(path)
    finish()
  }

  private fun hasCamera(): Boolean {
    return packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)
  }

  private fun hasCameraPermission(): Boolean {
    return ContextCompat.checkSelfPermission(this, android.Manifest.permission.CAMERA) ==
      PackageManager.PERMISSION_GRANTED
  }

  private fun launchCamera() {
    try {
      val file = File(cacheDir, "overlay_visit_${System.currentTimeMillis()}.jpg")
      photoFile = file
      val uri =
        FileProvider.getUriForFile(
          this,
          "${applicationContext.packageName}.fileprovider",
          file,
        )
      photoUri = uri

      val intent =
        Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
          putExtra(MediaStore.EXTRA_OUTPUT, uri)
          addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }

      @Suppress("DEPRECATION")
      startActivityForResult(intent, REQUEST_CAPTURE)
    } catch (e: Exception) {
      OverlayCameraBridge.deliverPhoto(null)
      finish()
    }
  }

  companion object {
    private const val REQUEST_CAPTURE = 9101
    private const val REQUEST_CAMERA = 9102
  }
}
