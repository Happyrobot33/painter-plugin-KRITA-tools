from PyQt5.QtGui import *
from PyQt5.QtWidgets import *
from PyQt5.QtCore import *
from krita import *
import sys
import os
import io
from PIL import Image

def addFileLayer(doc, node, path, layerName, opacity, blendmode):
    #double the forward slashes
    path = path.replace("/", "//")
    #create the variable
    layer = doc.createNode(layerName, "paintlayer")
    #get the pixel information of the file
    file = Image.open(path)


    #This is a great hack to determine if a layer is a fill layer
    #essentially, getcolors will return none if the image has more than 2 colors in it
    #fill layers will always only have 2 colors in them, the fill color and the background color
    #if it is a fill layer, we can skip the bytearray step and just setup a fill layer instead
    if file.getcolors(2) == None:
        b, g, r, a = file.split()
        im = Image.merge("RGBA", (r, g, b, a))

        ba = bytearray(im.tobytes())
        layer.setPixelData(ba, 0, 0, doc.width(), doc.height())
    else:
        #create a paint layer filled with the color
        #getcolors is like this (count, (r, g, b, a))
        #we need to determine which one isnt black
        colors = file.getcolors(2)
        color = file.getcolors(2)[0][1]
        if colors[0][1] == (0, 0, 0, 0) or colors[0][1] == (0, 0, 0, 255):
            color = colors[1][1]
            #quick check to make sure the image isnt ONLY black
            if colors[1][1] == (0, 0, 0, 0) or colors[1][1] == (0, 0, 0, 255):
                color = colors[0][1]

        file.paste(color, (0, 0, doc.width(), doc.height()))
        b, g, r, a = file.split()
        im = Image.merge("RGBA", (r, g, b, a))

        ba = bytearray(im.tobytes())

        layer.setPixelData(ba, 0, 0, doc.width(), doc.height())

        #i = InfoObject()
        #i.setProperty("color", QColor(255, 0, 0, 255))
        #s = Selection()
        #s.select(0, 0, doc.width(), doc.height(), 255)
        #layer = doc.createFillLayer(layerName, "color", i, s)
        #i = InfoObject();
        #i.setProperty("color", "#0f87e6")
        #s = Selection();
        #s.select(0, 0, doc.width(), doc.height(), 255)
        #TODO: WHY THE FUCK DOES THIS FUNCTION NOT WORK IN KRITA
        #layer = doc.createFillLayer("testing", "Color", i, s)
        #QMessageBox.information(None, "Error", str(layer))

    layer.setBlendingMode(blendmode)
    #round the opacity to the nearest 1
    opacity = round(opacity)
    layer.setOpacity(opacity)
    node.addChildNode(layer, None)
    #delete the original image at the path
    os.remove(path)
    return layer

def addGroupLayer(doc, node, layerName, opacity, blendmode):
    layer = doc.createGroupLayer(layerName)
    layer.setBlendingMode(blendmode)
    #round the opacity to the nearest 1
    opacity = round(opacity)
    layer.setOpacity(opacity)
    node.addChildNode(layer, None)
    return layer

def addTransparencyMask(doc, layer, path):
    #double the forward slashes
    path = path.replace("/", "//")

    mask = doc.createTransparencyMask(layer.name())

    #get the pixel information of the mask file
    maskFile = Image.open(path)
    #make sure its in grayscale
    maskFile = maskFile.convert("L")

    ba = bytearray(maskFile.tobytes())

    mask.setPixelData(ba, 0, 0, doc.width(), doc.height())
    layer.addChildNode(mask, None)
    #delete the original image at the path
    os.remove(path)
    return mask

class Window(QWidget):
  
    def __init__(self):
        super().__init__()
  
        # calling initUI method
        self.initUI()
  
    # method for creating widgets
    def initUI(self):
  
        # creating progress bar
        self.pbar = QProgressBar(self)
  
        # setting its geometry
        self.pbar.setGeometry(30, 40, 200, 25)
  
        # setting window geometry
        self.setGeometry(300, 300, 280, 170)
  
        # setting window action
        self.setWindowTitle("Python")
  
        # showing all the widgets
        self.show()

    #update the progress bar
    def updateProgress(self, progress, message):
        self.pbar.setValue(progress)
        self.pbar.setFormat(message)
    
    def setTotalProgress(self, progress):
        self.pbar.setMaximum(progress)

def close(doc, name, path):
    #double the forward slashes
    path = path.replace("/", "//")
    #save the file
    doc.setBatchmode(True)
    doc.saveAs(path + name + ".kra")
    #close the file
    doc.close()

def main():
    # create pyqt5 app
    App = QApplication(sys.argv)
  
    # create the instance of our Window
    window = Window()
  
    # start the app
    #sys.exit(App.exec())
