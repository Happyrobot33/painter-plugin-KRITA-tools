function exportMaps() {
  var paths = alg.settings.value("exportMaps", {})

  return {
    isChecked: function isChecked(path) {
      return !(path in paths) || !!paths[path];
    }
  }
}

function ExportConfig() {
  this.padding = "Infinite"
  this.dilation = 0
  this.bitDepth = 8
  this.keepAlpha = true
}

ExportConfig.prototype = {
  clone: function() {
    var conf = new ExportConfig
    conf.padding = this.padding
    conf.dilation = this.dilation
    conf.bitDepth = this.bitDepth
    conf.keepAlpha = this.keepAlpha
    return conf
  },

  usePadding : function(val) {
    this.padding = (val === true) ? "Infinite" : "Transparent"
  }
}


//add tab via ascii code
var tab = "    ";

KritaExporter.prototype = {
  /*
  * Main function of the script
  * Browsing of all layers into the document structure
  */
  run: function() {
    var mapsList = Krita.exportMaps();

    function documentNbStacks(document) {
      return document.materials
        .map(function(m) {
          return !mapsList.isChecked(m.name)?
            0 :
            m.stacks.filter(function(s) {
              return mapsList.isChecked(m.name + "." + s.name);
            }).length; // Count checked stacks on a texture set
        })
        .reduce(function(a, b){ return a + b}, 0); // Count sum of texture sets checked stacks
    }
    function stackNbChannel(materialName, stack) {
      return stack.channels
        .filter(function(c) {
          return mapsList.isChecked(materialName + "." + stack.name + "." + c);
        }).length;
    }
    function elementNbLayers(element) {
      var nbLayers = 1;
      if (element.layers != undefined) {
        nbLayers = element.layers
          .map(elementNbLayers)
          .reduce(function(a, b){ return a + b}, 0);
      }
      return nbLayers + (element.hasMask? 1 : 0);
    }

    function totalCheckedLayers(document) {
      // Calculate the total number of checked stacks in the document
      var totalStacks = documentNbStacks(document);
    
      // Initialize a variable to keep track of the total checked layers
      var totalCheckedLayers = 0;
    
      // Iterate through each material in the document
      document.materials.forEach(function(material) {
        // Iterate through each stack in the material
        material.stacks.forEach(function(stack) {
          // Calculate the number of checked channels in the stack
          var checkedChannels = stackNbChannel(material.name, stack);
    
          // Calculate the number of layers in the stack
          var layersInStack = elementNbLayers(stack);
    
          // Add the product of checked channels and layers in the stack to the total
          totalCheckedLayers += checkedChannels * layersInStack;
        });
      });
    
      return totalCheckedLayers;
    }

    var self = this;
    var doc_str = alg.mapexport.documentStructure();

    //total up all selected layers
    var totalLayers = totalCheckedLayers(doc_str);
    alg.log.info("Total layers: " + totalLayers);
    //return;
    //this needs to be accessible to the layersDFS function
    //on value set, run
    //self.logUserInfo("Exporting " + value + "/" totalLayers + " (" + percent + "%) layers to Krita");
    var progress = {
      value: 0,
      total: totalLayers
    }

    alg.log.info("Exporting " + totalLayers + " layers to Krita");

    //Browse material
    for (var materialId in doc_str.materials) {
      var material = doc_str.materials[materialId];
      if (!mapsList.isChecked(material.name)) continue
      this.materialName = material.name;
      //Browse stacks
      for (var stackId in material.stacks) {
        // Ensure checked state then update the progress bar
        var stack = material.stacks[stackId];
        var stackPath = material.name + "." + stack.name
        if (!mapsList.isChecked(stackPath)) continue

        var totalLayers = elementNbLayers(stack);
        this.stackName = stack.name;

        //Browse channels
        for (var channelId in stack.channels) {
          // Ensure checked state then update the progress bar
          this.channel = stack.channels[channelId];
          var channelPath = stackPath + "." + this.channel
          if (!mapsList.isChecked(channelPath)) continue

          var channelFormat = alg.mapexport.channelFormat([this.materialName, this.stackName],this.channel)
          var bitDepth = alg.settings.value("bitDepth", -1)
          this.exportConfig.bitDepth = bitDepth == -1 ? channelFormat.bitDepth : bitDepth
          
          //PNG export of a channel snapshot into the path export
          //this exports the snapshot of the channel into 1 file
          //TODO: Make this a configurable option
          //var filename = this.createFilename(".png");
          //var exportConfig = this.exportConfig.clone()
          //exportConfig.keepAlpha = false
          //alg.mapexport.save([this.materialName, this.stackName, this.channel], filename, exportConfig);
          
          //get export width and height
          var resolution = alg.mapexport.textureSetResolution(this.materialName);
          var exportWidth = resolution[0];
          var exportHeight = resolution[1];

          //add new document
          this.kritaScript += tab + "doc = Krita.instance().createDocument(" + exportWidth + ", " + exportHeight + ", \"" + this.materialName + "_" + this.stackName + "_" + this.channel + "\"," + "\"RGBA\"," + "\"U8\"," + "\"\", 0)\n";
          this.kritaScript += tab + "root = doc.rootNode()\n";
          
          //set total layers
          this.kritaScript += tab + "window.setTotalProgress(" + stack.layers.length + ")\n";
          
          for (var layerId = 0; layerId < stack.layers.length; ++layerId) {
            this.layersDFS(stack.layers[layerId], "root", progress, self);
            //Update the progress bar
            this.kritaScript += tab + "window.updateProgress(" + layerId + ",\"" + this.materialName + "_" + this.stackName + "_" + this.channel + "_" + layerId + "\")\n";
          }

          //set color space
          if(this.channel == "basecolor" || this.channel == "diffuse" || this.channel == "specular" || this.channel == "emissive" || this.channel == "transmissive" ) {
            //this.kritaScript += tab + "doc.setColorProfile(\"scRGB (linear)\")\n";
            this.kritaScript += tab + "doc.setColorSpace(\"RGBA\", \"U8\", \"scRGB (linear)\")\n";
          }

          //close document
          this.kritaScript += tab + "close(doc, " + "\"" + this.materialName + "_" + this.stackName + "_" + this.channel + "\",\"" + this.exportPath + "\")\n";
          
          /*
          // Add default background in normal channel
          if(this.channel === "normal") {
            this.kritaScript += this.newFillLayerStr("Background", {R:128, G:128, B:255});
            this.kritaScript += "app.activeDocument.activeLayer.move(app.activeDocument, ElementPlacement.PLACEATEND); \n";
          }
          */
        }
      }
    }
  },

  /*
   * Recursive function to explore a hierarchy of layers
   * Leaf has exported as photoshop layer
   * Folder has exported as photoshop groupe
   */
  layersDFS: function(layer, parentNode, progress, self) {
    //The layer is a leaf
    if (layer.layers == undefined) {
      //export individual layer
      var filename = this.createFilename("_" + layer.uid + ".png");
      //TODO: Will need to determine if a layer image is a fill layer or not manually, there does not seem to be a built in endpoint for this in substance :()

      alg.mapexport.save([layer.uid, this.channel], filename, this.exportConfig);
      var blending = alg.mapexport.layerBlendingModes(layer.uid)[this.channel];
      var kritaOpacity = 255 * (blending.opacity / 100);

      //add file layer
      this.kritaScript += tab + "layer = addFileLayer(doc," + parentNode + ",\"" + filename + "\",\"" + layer.name + "\"," + kritaOpacity + ",\"" + this.convertBlendingMode(blending.mode, 0) + "\")\n";

      updateProgress();
      //Add mask if exist
      if (layer.hasMask == true) {
        updateProgress();
        this.addMask(layer);
      }
    }
    //The layer is a folder
    else {
      var blending = alg.mapexport.layerBlendingModes(layer.uid)[this.channel];
      var kritaOpacity = 255 * (blending.opacity / 100);

      //Create the folder into photoshop
      this.kritaScript += tab + "node_" + layer.uid + " = addGroupLayer(doc," + parentNode + ",\"" + layer.name + "\"," + kritaOpacity + ",\"" + this.convertBlendingMode(blending.mode, 0) + "\")\n";
      //Add mask if exist
      if (layer.hasMask == true) {
        this.addMask(layer);
      }
      //Browse layer tree from the current layer
      for (var layerId = 0; layerId < layer.layers.length; ++layerId) {
        this.layersDFS(layer.layers[layerId], "node_" + layer.uid, progress, self);
      }
    }

    function updateProgress() {
      progress.value++;
      alg.log.info("Progress: " + progress.value + "/" + progress.total);
      self.logProgressText("Exporting " + progress.value + "/" + progress.total + " (" + Math.round(progress.value / progress.total * 100) + "%) layers to Krita");
      self.logProgress(progress.value, progress.total);
    }
  },

  /*
   * Add the layer/folder mask if exist
   */
  addMask: function(layer) {
    //PNG export of the mask into the path export
    var filename = this.createFilename("_" + layer.uid + "_mask.png");
    alg.mapexport.save([layer.uid, "mask"], filename, this.exportConfig);
    //Create the mask into photoshop
    this.kritaScript += tab + "addTransparencyMask(doc, layer, \"" + filename + "\")\n";
  },

  /**********Photoshop generation script**********/

  createFilename: function(concate) {
    concate = concate || ''
    return (this.exportPath + this.materialName + "_" +this.stackName + "_" + this.channel + concate).replace("__", "_");
  },

  /*
   * Return the string to assign a blending mode to the current photoshop layer/folder
   * Folder in Passthrough mode have to be assign to PASSTHROUGH but layer
   */
  convertBlendingMode: function(painterMode, isFolder) {
    var blendingMode = "";
    if (painterMode == "Passthrough") {
      if (isFolder == 1) {
        blendingMode = blendingMode + "PASSTHROUGH";
      } else {
        blendingMode = blendingMode + "NORMAL";
      }
      return blendingMode;
    }
    switch(painterMode) {
    case "Normal":
    case "Replace":                      blendingMode = "normal";
      break;
    case "Multiply":                     blendingMode = "multiply"; break;
    case "Divide":                       blendingMode = "divide"; break;
    case "Linear dodge (Add)":           blendingMode = "linear_dodge"; break;
    case "Subtract":                     blendingMode = "subtract"; break;
    case "Difference":                   blendingMode = "diff"; break;
    case "Exclusion":                    blendingMode = "exclusion"; break;
    case "Overlay":                      blendingMode = "overlay"; break;
    case "Screen":                       blendingMode = "screen"; break;
    case "Linear burn":                  blendingMode = "linear_burn"; break;
    case "Color burn":                   blendingMode = "burn"; break;
    case "Color dodge":                  blendingMode = "dodge"; break;
    case "Soft light":                   blendingMode = "soft_light"; break;
    case "Hard light":                   blendingMode = "hard_light"; break;
    case "Vivid light":                  blendingMode = "vivid_light"; break;
    case "Pin light":                    blendingMode = "pin_light"; break;
    case "Saturation":                   blendingMode = "saturation"; break;
    case "Color":                        blendingMode = "color"; break;
    case "Value":                        blendingMode = "value"; break;
    //case "Normal map combine":           blendingMode = "Overlay_Normal()"; break;
    //case "Normal map detail":            blendingMode = "Overlay_Normal()"; break;
    //case "Normal map inverse detail":    blendingMode = "Overlay_Normal()"; break;
    case "Disable":
    case "Inverse divide":
    case "Darken (Min)":
    case "Lighten (Max)":
    case "Inverse Subtract":
    case "Signed addition (AddSub)":
    case "Tint":
    default:
      blendingMode = ""
    }
    return blendingMode;
  }

}

function KritaExporter(ptext, pbar) {
  this.logProgressText =
    function logProgressText(str) {
      if (ptext) {
        ptext(str)
      }
      else {
        alg.log.info("<font color=#00FF00>"+str+"</font>")
      }
    }

  this.logProgress =
    function logProgress(value, total) {
      if (pbar) {
        pbar(value, total)
      }
      else {
        alg.log.info("<font color=#00FF00>"+value+"/"+total+"</font>")
      }
    }

  //Padding's struct
  this.exportConfig = new ExportConfig()
  this.exportConfig.usePadding(alg.settings.value("padding", false))

  //Get the project name
  var projectName = alg.project.name()

  //The export path is the working directory
  this.exportPath = alg.mapexport.exportPath() + "/" + projectName + "_krita_export/";

  //Add the header photoshop header script
  var script = alg.fileIO.open(alg.plugin_root_directory + "/runner_header.py", 'r');
  this.kritaScript = script.readAll();
  script.close();

  //Run the script
  this.run(this);

  //add the footer script
  var footerScript = alg.fileIO.open(alg.plugin_root_directory + "/runner_footer.py", 'r');
  this.kritaScript += footerScript.readAll();
  footerScript.close();

  try{
    var scriptFile = alg.fileIO.open("C://Users//Matthew//AppData//Roaming//kritarunner" + "/runner.py", 'w');
    scriptFile.write(this.kritaScript);
    scriptFile.close();
  } catch (error) {
    alg.log.error(error.message);
    return;
  }

  this.logProgressText("Export done");
  if (alg.settings.value("launchKrita", false)) {
    this.logProgressText("Starting Krita...");
    if (Qt.platform.os == "windows") {
      alg.subprocess.startDetached(["\"" + "C:/Program Files/Krita (x64)/bin/kritarunner.exe"  + "\"", "-s", "runner"]);
      //alg.subprocess.startDetached(["\"" + alg.settings.value("photoshopPath", "") + "\"", "\"" + this.exportPath.split('/').join('\\') + "photoshopScript.jsx\""]);
    }
  }
}

function importPainterDocument(ptext, pbar) {
  new KritaExporter(ptext, pbar);
}
