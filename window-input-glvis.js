var IDs = (function () {
    function IDs() {
    }
    IDs.dots = "dots";
    IDs.circles = "circles";
    IDs.shader = "shader";
    IDs.pointCloud = "pointCloud";
    IDs.eqPointCloud = "eqPointCloud";
    IDs.gpgpuPointCloud = "gpgpuPointCloud";
    IDs.videoDistortion = "videoDistortion";
    IDs.lsystem = "lsystem";
    return IDs;
})();
var AudioAnalyser = (function () {
    function AudioAnalyser(context, fftSize) {
        this._analyser = context.createAnalyser();
        this.fftSize = fftSize;
        this.segmentSize = fftSize / 8.0;
        this.frequencyBuffer = new Uint8Array(this.fftSize);
        this.timeDomainBuffer = new Uint8Array(this.fftSize);
    }
    AudioAnalyser.prototype.connectSource = function (node) {
        node.connect(this._analyser);
        this._connected = true;
    };
    AudioAnalyser.prototype.connectDestination = function (dest) {
        this._analyser.connect(dest);
    };
    AudioAnalyser.prototype.getFrequencyData = function () {
        if (this._connected) {
            this._analyser.getByteFrequencyData(this.frequencyBuffer);
        }
        return this.frequencyBuffer;
    };
    AudioAnalyser.prototype.getEQSegments = function () {
        if (this.frequencyBuffer != undefined) {
            var vec = [0.0, 0.0, 0.0, 0.0];
            for (var i = 0; i < this.segmentSize * 4; i++) {
                var val = this.frequencyBuffer[i];
                vec[Math.floor(i / this.segmentSize)] += val * val / (255 - ((255 - val) * i / (this.segmentSize * 4.0)));
            }
            return new THREE.Vector4(vec[0] / (256.0 * this.segmentSize), vec[1] / (256.0 * this.segmentSize), vec[2] / (256.0 * this.segmentSize), vec[3] / (256.0 * this.segmentSize));
        }
        return new THREE.Vector4(0.0, 0.0, 0.0, 0.0);
    };
    AudioAnalyser.prototype.getTimeDomainData = function () {
        if (this._connected) {
            this._analyser.getByteTimeDomainData(this.timeDomainBuffer);
        }
        return this.timeDomainBuffer;
    };
    return AudioAnalyser;
})();
/// <reference path="./Source"/>
/// <reference path="../AudioAnalyser"/>
var AudioSource = (function () {
    function AudioSource(audioContext) {
        this._audioContext = audioContext;
        this._audioAnalyser = new AudioAnalyser(this._audioContext, AudioSource.FFT_SIZE);
        this._audioEventSubject = new Rx.Subject();
    }
    AudioSource.prototype.updateSourceNode = function (sourceNode) {
        this._audioAnalyser.connectSource(sourceNode);
    };
    AudioSource.prototype.usePlayerSource = function (source) {
        var mediaElement = this._audioContext.createMediaElementSource(source);
        this.updateSourceNode(mediaElement);
        this._audioAnalyser.connectDestination(this._audioContext.destination);
        return mediaElement;
    };
    AudioSource.prototype.observable = function () {
        return this._audioEventSubject.asObservable();
    };
    AudioSource.prototype.animate = function () {
        if (this._audioAnalyser === undefined) {
            return;
        }
        var frequencyBuffer = this._audioAnalyser.getFrequencyData();
        var timeDomainBuffer = this._audioAnalyser.getTimeDomainData();
        var eqSegments = this._audioAnalyser.getEQSegments();
        this._audioEventSubject.onNext({
            frequencyBuffer: frequencyBuffer,
            timeDomainBuffer: timeDomainBuffer
        });
    };
    AudioSource.FFT_SIZE = 1024;
    return AudioSource;
})();
var RendererUtils;
(function (RendererUtils) {
    function copyBuffer(source, dest) {
        for (var i = 0; i < source.length; i++) {
            dest[i] = source[i];
        }
    }
    RendererUtils.copyBuffer = copyBuffer;
    function copyArray(source, dest) {
        for (var i = 0; i < source.length; i++) {
            dest[i] = source[i];
        }
    }
    RendererUtils.copyArray = copyArray;
})(RendererUtils || (RendererUtils = {}));
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var ObjectMaterial = (function (_super) {
    __extends(ObjectMaterial, _super);
    function ObjectMaterial() {
        _super.apply(this, arguments);
    }
    return ObjectMaterial;
})(THREE.Object3D);
/// <reference path="./VisualizationRenderer"/>
/// <reference path="../Sources/AudioSource"/>
/// <reference path="./RendererUtils"/>
/// <reference path="../ObjectMaterial"/>
var ObjectRenderer = (function () {
    function ObjectRenderer(object) {
        this._object = object;
        this._buffers = {};
        console.log(object);
        if (this._object.material.uniforms) {
            var uniforms = this._object.material.uniforms;
            for (var name in uniforms) {
                var uniform = uniforms[name];
                if (uniform.type == "t") {
                    if (uniform.value && uniform.value.image && uniform.value.image.nodeName &&
                        uniform.value.image.nodeName.toLowerCase() === "canvas") {
                        var canvas = document.createElement("canvas");
                        canvas.width = 1024;
                        canvas.height = 1024;
                        this._buffers[uniform.name] = canvas.getContext("2d");
                        this._object.material.uniforms[uniform.name] = {
                            name: uniform.name,
                            type: "t",
                            value: new THREE.Texture(canvas)
                        };
                    }
                    else if (uniform.value && uniform.value.image && uniform.value.image.data) {
                        if (uniform.value.image.data instanceof Uint8Array) {
                            this._buffers[uniform.name] = new Uint8Array(uniform.value.image.data.length);
                        }
                        else {
                            this._buffers[uniform.name] = new Float32Array(uniform.value.image.data.length);
                        }
                        var dataTexture = new THREE.DataTexture(this._buffers[uniform.name], uniform.value.image.width, uniform.value.image.height, THREE.RGBAFormat, this._buffers[uniform.name] instanceof Uint8Array ? THREE.UnsignedByteType : THREE.FloatType, THREE.UVMapping, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping, THREE.NearestFilter, THREE.NearestFilter, 1);
                        this._object.material.uniforms[uniform.name] = {
                            name: uniform.name,
                            type: "t",
                            value: dataTexture
                        };
                        RendererUtils.copyBuffer(uniform.value.image.data, this._buffers[uniform.name]);
                        this._object.material.uniforms[uniform.name].value
                            .needsUpdate = true;
                    }
                    else {
                        this._buffers[uniform.name] = new Float32Array(uniform.value.width * uniform.value.height * 4);
                        var dataTexture = new THREE.DataTexture(this._buffers[uniform.name], this._buffers[uniform.name].length / 4, 1, THREE.RGBAFormat, THREE.UnsignedByteType, THREE.UVMapping, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping, THREE.LinearFilter, THREE.LinearMipMapLinearFilter, 1);
                        this._object.material.uniforms[uniform.name] = {
                            name: uniform.name,
                            type: "t",
                            value: dataTexture
                        };
                        console.log(uniform.name);
                        console.log(this._object.material.uniforms);
                        console.log(this._object.material.uniforms[uniform.name]);
                        console.log(this._object.material.uniforms[uniform.name].value);
                    }
                }
            }
        }
        if (this._object.material.attributes) {
            for (var name in this._object.material.attributes) {
                var attr = this._object.material.attributes[name];
                this._buffers[attr.name] = attr.value;
                this._object.material.attributes[name] = {
                    name: attr.name,
                    type: attr.type,
                    value: this._buffers[attr.name]
                };
            }
        }
        else if (this._object.geometry.attributes) {
            for (var name in this._object.geometry.attributes) {
                var geoAttr = this._object.geometry.attributes[name];
                this._buffers[name] = geoAttr.array;
                this._object.geometry.addAttribute(name, new THREE.BufferAttribute(this._buffers[name], geoAttr.itemSize));
                this._object.geometry.attributes[name].needsUpdate = true;
            }
        }
    }
    ObjectRenderer.prototype.update = function (updateData, resolution) {
        var _this = this;
        if (updateData.uniforms) {
            updateData.uniforms.forEach(function (uniform) {
                if (uniform.name == "resolution") {
                    _this._object.material.uniforms[uniform.name].value = resolution;
                }
                else if (uniform.type == "t") {
                    if (uniform.value.image && uniform.value.image.nodeName &&
                        uniform.value.image.nodeName.toLowerCase() === "canvas") {
                        _this._buffers[uniform.name].drawImage(uniform.value.image, 0, 0);
                        _this._object.material.uniforms[uniform.name].value
                            .needsUpdate = true;
                    }
                    else if (uniform.value.image && uniform.value.image.data) {
                        RendererUtils.copyBuffer(uniform.value.image.data, _this._buffers[uniform.name]);
                        _this._object.material.uniforms[uniform.name].value
                            .needsUpdate = true;
                    }
                    else {
                        console.log(uniform);
                    }
                }
                else if (uniform.type.startsWith("v")) {
                    var arr = [];
                    uniform.value.toArray(arr);
                    _this._object.material.uniforms[uniform.name].value
                        .fromArray(arr);
                }
            });
        }
        if (updateData.attributes) {
            updateData.attributes.forEach(function (attr) {
                RendererUtils.copyBuffer(attr.value, _this._buffers[attr.name]);
                var mat = _this._object.material;
                if (mat.attributes && mat.attributes[attr.name]) {
                    _this._object.material.attributes[attr.name].needsUpdate = true;
                }
                else {
                    _this._object.geometry.attributes[attr.name].needsUpdate = true;
                }
            });
        }
    };
    return ObjectRenderer;
})();
var EqPointCloudRenderer = (function (_super) {
    __extends(EqPointCloudRenderer, _super);
    function EqPointCloudRenderer(pointCloud) {
        _super.call(this, pointCloud);
        this._pc = pointCloud;
    }
    EqPointCloudRenderer.prototype.update = function (update, resolution) {
        _super.prototype.update.call(this, update, resolution);
        this._pc.rotateY(update.loudness / 128.0);
        this._pc.rotateX(update.loudness / 256.0);
    };
    return EqPointCloudRenderer;
})(ObjectRenderer);
var GPGPUPointCloudRenderer = (function (_super) {
    __extends(GPGPUPointCloudRenderer, _super);
    function GPGPUPointCloudRenderer(pc) {
        _super.call(this, pc);
    }
    GPGPUPointCloudRenderer.prototype.update = function (update, resolution) {
        _super.prototype.update.call(this, update, resolution);
        RendererUtils.copyBuffer(update.texturePosition, this._buffers["texturePosition"]);
        RendererUtils.copyBuffer(update.textureVelocity, this._buffers["textureVelocity"]);
        this._object.material.uniforms["texturePosition"].value.needsUpdate = true;
        this._object.material.uniforms["textureVelocity"].value.needsUpdate = true;
    };
    return GPGPUPointCloudRenderer;
})(ObjectRenderer);
var VideoDistortionRenderer = (function (_super) {
    __extends(VideoDistortionRenderer, _super);
    function VideoDistortionRenderer(plane) {
        _super.call(this, plane);
    }
    VideoDistortionRenderer.prototype.update = function (updateData, resolution) {
        _super.prototype.update.call(this, updateData, resolution);
    };
    return VideoDistortionRenderer;
})(ObjectRenderer);
var LSystemRenderer = (function (_super) {
    __extends(LSystemRenderer, _super);
    function LSystemRenderer(line) {
        _super.call(this, line);
        this._line = line;
    }
    LSystemRenderer.prototype.update = function (update, resolution) {
        _super.prototype.update.call(this, update, resolution);
        this._line.rotateY(update.rotation);
        this._line.rotateZ(update.rotation * 0.5);
    };
    return LSystemRenderer;
})(ObjectRenderer);
/// <reference path="../Models/Visualizations/IDs"/>
/// <reference path="../Models/Visualizations/VisualizationRenderer"/>
/// <reference path="../Models/Visualizations/ObjectRenderer"/>
/// <reference path="../Models/Visualizations/EqPointCloudRenderer"/>
/// <reference path="../Models/Visualizations/GPGPUPointCloudRenderer"/>
/// <reference path="../Models/Visualizations/VideoDistortionRenderer"/>
/// <reference path="../Models/Visualizations/LSystemRenderer.ts"/>
/// <reference path="../typed/three.d.ts"/>
/// <reference path="../Models/Window"/>
/// <reference path="../typed/rx.d.ts"/>
var GLVis;
(function (GLVis) {
    var WindowInput = (function () {
        function WindowInput() {
            var _this = this;
            this._canvas = document.createElement('canvas');
            this.onWindowResize();
            window.addEventListener("resize", function (__) { return _this.onWindowResize(); }, false);
            window.newVis = function (vis) { return _this.newVis(vis); };
            window.update = function (updateData) { return _this.update(updateData); };
        }
        WindowInput.prototype.render = function (el) {
            var _this = this;
            this._camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 350);
            this._camera.position.z = 100;
            this._scene = new THREE.Scene();
            this._renderer = new THREE.WebGLRenderer();
            el.appendChild(this._renderer.domElement);
            this.onWindowResize();
            window.addEventListener("resize", function (__) { return _this.onWindowResize(); }, false);
            requestAnimationFrame(function () { return _this.animate(); });
        };
        WindowInput.prototype.update = function (data) {
            if (this._visRenderer) {
                this._visRenderer.update(data, this._resolution);
            }
        };
        WindowInput.prototype.onWindowResize = function () {
            if (this._renderer) {
                this._renderer.setSize(window.innerWidth, window.innerHeight);
            }
            this._resolution = new THREE.Vector2(window.innerWidth, window.innerHeight);
        };
        WindowInput.prototype.newVis = function (data) {
            var meshes = data.objects;
            var loader = new THREE.ObjectLoader();
            var obj = new THREE.Object3D();
            obj.position = new THREE.Vector3(0, 0, 0);
            if (data.type == IDs.shader) {
                meshes.forEach(function (mesh) {
                    var newMesh = loader.parse(mesh.toJSON());
                    obj.add(newMesh);
                });
                this._visRenderer = new ObjectRenderer(obj.children[0]);
            }
            else if (data.type == IDs.videoDistortion) {
                meshes.forEach(function (mesh) {
                    var newMesh = loader.parse(mesh.toJSON());
                    obj.add(newMesh);
                });
                this._visRenderer = new VideoDistortionRenderer(obj.children[0]);
            }
            else if (data.type == IDs.pointCloud || data.type == IDs.eqPointCloud ||
                data.type == IDs.gpgpuPointCloud) {
                var pc = new THREE.PointCloud(meshes[0].geometry, meshes[0].material);
                obj.add(pc);
                if (data.type == IDs.eqPointCloud) {
                    this._visRenderer = new EqPointCloudRenderer(pc);
                }
                else if (data.type == IDs.gpgpuPointCloud) {
                    this._visRenderer = new GPGPUPointCloudRenderer(pc);
                }
                else {
                    this._visRenderer = new ObjectRenderer(pc);
                }
            }
            else if (data.type == IDs.lsystem) {
                /*console.log(meshes[0]);*/
                var parsedLines = loader.parse(meshes[0].toJSON());
                /*obj.add(line);*/
                var lines = new THREE.Line(parsedLines.geometry, new THREE.LineBasicMaterial({
                    vertexColors: THREE.VertexColors,
                    linewidth: 5.0
                }), THREE.LinePieces);
                obj.add(lines);
                this._visRenderer = new LSystemRenderer(lines);
            }
            else {
                console.log("Couldn't find renderer type " + data.type);
            }
            if (this._sceneContainer) {
                this._scene.remove(this._sceneContainer);
            }
            this._sceneContainer = obj;
            this._scene.add(this._sceneContainer);
        };
        WindowInput.prototype.animate = function () {
            var _this = this;
            requestAnimationFrame(function () { return _this.animate(); });
            if (this._scene) {
                this._renderer.render(this._scene, this._camera);
            }
        };
        return WindowInput;
    })();
    GLVis.WindowInput = WindowInput;
})(GLVis || (GLVis = {}));
