try:
    main()
except Exception as e:
    exc_type, exc_obj, exc_tb = sys.exc_info()
    fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
    error = str(exc_type) + " " + str(fname) + " " + str(exc_tb.tb_lineno)
    QMessageBox.information(None, "Error", error)
    #raise the exception again
    raise e
