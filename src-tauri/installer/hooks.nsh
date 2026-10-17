; Register with Windows Default Apps as well as Tauri's Open With handler.
; An existing protected UserChoice must be changed through the Windows UI.
!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr SHCTX "Software\Classes\Typo.Markdown\shell\open\command" "" '$\"$INSTDIR\${MAINBINARYNAME}.exe$\" $\"%1$\"'
  WriteRegStr SHCTX "Software\Typo\Capabilities" "ApplicationName" "Typo"
  WriteRegStr SHCTX "Software\Typo\Capabilities" "ApplicationDescription" "Markdown editor"
  WriteRegStr SHCTX "Software\Typo\Capabilities\FileAssociations" ".md" "Typo.Markdown"
  WriteRegStr SHCTX "Software\Typo\Capabilities\FileAssociations" ".markdown" "Typo.Markdown"
  WriteRegStr SHCTX "Software\RegisteredApplications" "Typo" "Software\Typo\Capabilities"
  IfSilent typo_skip_defaults
    ${If} $UpdateMode = 0
      ExecShell "open" "ms-settings:defaultapps"
    ${EndIf}
  typo_skip_defaults:
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegValue SHCTX "Software\RegisteredApplications" "Typo"
  DeleteRegKey SHCTX "Software\Typo\Capabilities"
!macroend
