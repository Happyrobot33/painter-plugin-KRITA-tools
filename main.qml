import QtQuick 2.2
import Painter 1.0
import QtQuick.Layouts 1.2
import QtQuick.Dialogs 1.0
import QtQuick.Controls 1.4
import QtQuick.Controls.Styles 1.4
import Qt.labs.platform 1.1
import AlgWidgets 2.0
import AlgWidgets.Style 2.0

import "Krita.js" as Krita

PainterPlugin {
	Component.onCompleted: {
		// default value settings
		if (!alg.settings.contains("launchKrita")) {
			if (Qt.platform.os == "windows" || Qt.platform.os == "osx") {
				alg.settings.setValue("launchKrita", true);
		 	} else {
				alg.settings.setValue("launchKrita", false);
		 	}
		 	alg.settings.setValue("padding", false);
		}
		var sendtoAction = alg.ui.addAction(alg.ui.AppMenu.SendTo, qsTr("Export to Krita"), qsTr("Export to Krita"), Qt.resolvedUrl("icons/Krita_idle.png"), Qt.resolvedUrl("icons/Krita_idle.png"));
		sendtoAction.triggered.connect(internal.sendToTriggered);

		//check if kritarunner folder exists
		var appdata = StandardPaths.standardLocations(StandardPaths.HomeLocation)[0];
		//remove file:///
		appdata = appdata.substring(8);
		var kritarunnerFolder = appdata + "/AppData/Roaming/kritarunner";
		if (!alg.fileIO.exists(kritarunnerFolder)) {
			alg.log.info("Running Kritarunner for the first time");
			alg.subprocess.startDetached(["\"" + alg.settings.value("kritaPath")  + "\"", "-s", "runner"]);
		}
	}

	onConfigure: {
		// open the configuration panel
		configurePanel.open()
	}

	ConfigurePanel {
		id: configurePanel
	}

	QtObject {
	property bool loading: false
		id: internal

		function updateProgressWindow(text) {
			progressText.text = text
		}

		function updateProgressBar(value, max) {
			//print all properties of the object
			/*
			for (var property in progressBar) {
				alg.log.info(property + ": " + progressBar[property]);
			}
			*/
			progressBar.indeterminate = false
			progressBar.from = 0
			progressBar.to = max
			progressBar.value = value
		}

		function launchExportDialog() {
			exportDialog.open()
		}

		function launchExport() {
			try {
				loading = true;
				progressWindow.open()
				Krita.importPainterDocument(updateProgressWindow, updateProgressBar);
			}
			catch (e) {
				alg.log.warn(e.message)
			}
			finally {
				progressWindow.close()
				loading = false;
			}
		}

		function sendToTriggered() {
			if (!internal.loading) {
				if (!alg.settings.contains("KritaPath") && alg.settings.value("launchKrita", false)) {
					fileDialog.open();
				} else {
					internal.launchExportDialog()
				}
			}
		}
	}

	ExportDialog {
		id: exportDialog

		onAccepted: {
			close()
			internal.launchExport()
		}
	}

	AlgWindow {
		id: progressWindow
		minimumWidth: 400
		minimumHeight: 125
		maximumWidth: 400
		maximumHeight: 125
		title: qsTr("Export to Krita")
		flags: Qt.Dialog | Qt.CustomizeWindowHint | Qt.WindowTitleHint | Qt.WindowSystemMenuHint
		function reload() {
			progressText.text = qsTr("Export in progress...")
		}

		Rectangle {
			id: content
			color: "transparent"
			anchors.fill: parent
			anchors.margins: 12

			ColumnLayout {
				spacing: 18
				anchors.fill: parent

				Rectangle {
					color: "transparent"
					Layout.fillWidth: true
					AlgTextEdit {
						id: progressText
						anchors.centerIn: parent
						width: parent.width
						wrapMode: TextEdit.Wrap
						clip: true
						readOnly: true
					}
				}

				Rectangle {
					color: "transparent"
					Layout.fillWidth: true
					AlgProgressBar {
						id: progressBar
						anchors.centerIn: parent
						width: parent.width
						indeterminate: true
					}
				}
			}
		}
	}

	FileDialog {
		id: fileDialog
		title: qsTr("Please locate KritaRunner...")
		nameFilters: [ "Krita files (*.exe *.app)", "All files (*)" ]
		//selectedNameFilter: "Executable files (*)"
		onAccepted: {
			alg.settings.setValue("KritaPath", alg.fileIO.urlToLocalFile(fileUrl.toString()));
			internal.launchExportDialog()
		}
	}
}
