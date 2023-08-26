try:
    main()
except Exception as e:
    QMessageBox.information(None, "Error", str(e))
    #raise the exception again
    raise e
