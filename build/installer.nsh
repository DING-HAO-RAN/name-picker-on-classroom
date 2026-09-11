; NamePicker keeps the installer offline and self-contained.
; electron-builder supplies the application metadata and file associations.

!macro customInstall
  ; No network, updater, telemetry, or user-specific paths are added here.
!macroend

!macro customUnInstall
  ; Leave no updater or telemetry task behind.
!macroend
