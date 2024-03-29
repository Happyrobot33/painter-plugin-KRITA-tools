from PyQt5.QtGui import *
from PyQt5.QtWidgets import *
from PyQt5.QtCore import *
from krita import *
import sys
import os
import io
from PIL import Image
from PIL import ImageChops
from PIL import ImageStat
from PIL import ImageMath
import traceback

def addFileLayer(doc, node, path, layerName, opacity, blendmode):
    #double the forward slashes
    path = path.replace("/", "//")
    #create the variable
    layer = doc.createNode(layerName, "paintlayer")
    #get the pixel information of the file
    file = Image.open(path)
    #get the bit depth of the document
    bitDepth = doc.colorDepth()
    #convert to RGBA to make sure it has an alpha channel
    file = file.convert("RGBA")

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
            #check if there is a second color
            if len(colors) > 1:
                color = colors[1][1]
                #quick check to make sure the image isnt ONLY black
                if colors[1][1] == (0, 0, 0, 0) or colors[1][1] == (0, 0, 0, 255):
                    color = colors[0][1]
            else:
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
    #if blend mode is a empty string then turn the layer off since it likely wont composite correctly
    if (blendmode == ""):
        layer.setVisible(False)
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

#this runs once we are complete with a file
#This is to check for differences between the snapshot and the generated file,
#mainly to ensure that geometry masks were not used as we dont get that information
def checkForDifferences(doc, kraImagePath, snapshotImagePath):
    #load the snapshot image
    snapshot = Image.open(snapshotImagePath)

    #save a copy of the generated image to a png
    exportDocAsPNG(doc, kraImagePath, "generated")

    #load the generated image
    generated = Image.open(kraImagePath + "generated.png")

    #remove alpha channel from both since this is broken
    snapshot = snapshot.convert("RGB")
    generated = generated.convert("RGB")

    #check the difference between the two
    diff = ImageChops.difference(snapshot, generated)

    #delete the two images we created since we dont need them anymore
    os.remove(kraImagePath + "generated.png")
    os.remove(snapshotImagePath)

    #get percentile difference between the two
    stat = ImageStat.Stat(diff)
    diff_percent = sum(stat.mean) / (len(stat.mean) * 255) * 100
    
    #if the difference is greater than a set point, we have a problem
    if diff_percent > 5:
        TimedMessageBox("Error", "The generated image is not the same as the snapshot. Make sure you are not using geometry masks, as these are un-exportable due to substance painter limitations.", 5000)
        #QMessageBox.information(None, "Error", "The generated image is not the same as the snapshot. Make sure you are not using geometry masks, as these are un-exportable due to substance painter limitations.")

def TimedMessageBox(title, message, timeout=0):
    mbox = QMessageBox()
    mbox.setWindowTitle(title)
    mbox.setText(message)
    mbox.setStandardButtons(QMessageBox.Ok)
    mbox.setDefaultButton(QMessageBox.Ok)

    mbox.show()
    QTimer.singleShot(timeout, mbox.accept)

    #setup the window title to display timeouts
    if timeout > 0:
        #subdivide the timeout by 1000 to get seconds
        timeoutInSeconds = timeout / 1000
        #round the timeout to the nearest second
        timeoutInSeconds = round(timeoutInSeconds)
        for i in range(1, timeoutInSeconds + 1):
            timedTitle = title + " (" + str(timeoutInSeconds - i) + ")"
            QTimer.singleShot(i * 1000, lambda: mbox.setWindowTitle(timedTitle))

class Window(QWidget):
  
    def __init__(self):
        super().__init__()
  
        # calling initUI method
        self.initUI()
  
    # method for creating widgets
    def initUI(self):
  
        # create individual progress bar
        self.pbarindividual = QProgressBar(self)
        self.pbarindividual.setGeometry(30, 80, 200, 25)

        # create total progress bar
        self.pbartotal = QProgressBar(self)
        self.pbartotal.setGeometry(30, 40, 200, 25)
  
        # setting window geometry
        self.setGeometry(300, 300, 280, 170)
  
        # setting window action
        self.setWindowTitle("Substance Painter Krita Exporter")

        # setting window icon
        self.setWindowIcon(QIcon("icons/Krita_idle.png"))
  
        # showing all the widgets
        self.show()

    #update the progress bar
    def updateProgress(self, progress, message, bar):
        if bar == "individual":
            self.pbarindividual.setValue(progress)
            self.pbarindividual.setFormat(message)
        elif bar == "total":
            self.pbartotal.setValue(progress)
            self.pbartotal.setFormat(message)
        #call to process events
        QApplication.processEvents()
    
    def setTotalProgress(self, progress, bar):
        if bar == "individual":
            self.pbarindividual.setMaximum(progress)
        elif bar == "total":
            self.pbartotal.setMaximum(progress)

def close(doc, name, path):
    #double the forward slashes
    path = path.replace("/", "//")
    #save the file
    doc.setBatchmode(True)
    doc.saveAs(path + name + ".kra")
    #close the file
    doc.close()

def exportDocAsPNG(doc, path, name):
    #double the forward slashes
    path = path.replace("/", "//")
    #save the file
    doc.setBatchmode(True)
    #export to png
    doc.saveAs(path + name + ".png")

def main():
    # create pyqt5 app
    App = QApplication(sys.argv)
  
    # create the instance of our Window
    window = Window()
  
    # start the app
    #sys.exit(App.exec())
