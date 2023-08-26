try:
    main()
except Exception as e:
    #use traceback to get the error message
    error = traceback.format_exc()

    QMessageBox.information(None, "Error", error)
    #raise the exception again
    raise e
