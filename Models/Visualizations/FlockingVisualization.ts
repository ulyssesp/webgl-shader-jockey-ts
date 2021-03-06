class FlockingVisualization extends PointCloudVisualization {
  static ID = "flocking";
  private static POINT_TEX_WIDTH = 64;
  private static POINT_COUNT = FlockingVisualization.POINT_TEX_WIDTH *
  FlockingVisualization.POINT_TEX_WIDTH;
  private static CUBE_SIZE = 128;

  private _vertices: Array<THREE.Vector3>;

  private _material: THREE.ShaderMaterial;

  private _renderer: THREE.WebGLRenderer;
  private _gl: WebGLRenderingContext;
  private _scene: THREE.Scene;
  private _camera: THREE.Camera;

  private _audioSource: AudioSource;

  private _deltaUniform: IUniform<number>;
  private _lastTime: number = 0.0;
  private _loudnessUniform: IUniform<number>;
  private _accumulatedLoudnessUniform: IUniform<number>;
  private _beatUniform: IUniform<number>;
  private _resolutionUniform: IUniform<THREE.Vector2>;
  private _eqs: IUniform<THREE.Vector3>;

  /*private _textureUniforms: Array<IUniform<any>>;*/
  /*private _positionUniforms: Array<IUniform<any>>;
  private _velocityUniforms: Array<IUniform<any>>;*/

  private _textureShader: THREE.ShaderMaterial;
  private _positionShader: THREE.ShaderMaterial;
  private _velocityShader: THREE.ShaderMaterial;

  private _textureMesh: THREE.Mesh;
  private _rtPosition1: THREE.WebGLRenderTarget;
  private _rtPosition2: THREE.WebGLRenderTarget;
  private _rtVelocity1: THREE.WebGLRenderTarget;
  private _rtVelocity2: THREE.WebGLRenderTarget;

  private _positionBuffer: Float32Array;
  private _velocityBuffer: Float32Array;

  private _flipflop = true;

  private _pc: THREE.PointCloud;

  private _controlsProvider: ControlsProvider;
  private _beatControlName = "beatConstant";

  constructor(renderer: THREE.WebGLRenderer, audioSource: AudioSource, resolutionProvider: ResolutionProvider, timeSource: TimeSource, shaderLoader: ShaderLoader, controlsProvider?: ControlsProvider) {
    super(resolutionProvider, timeSource, shaderLoader, "flocking/point", controlsProvider);

    this._renderer = renderer;
    this._scene = new THREE.Scene();
    this._camera = new THREE.Camera();
    this._camera.position.z = 1.0;

    this._renderer.setFaceCulling(THREE.CullFaceNone);
    this._gl = this._renderer.getContext();

    this._audioSource = audioSource;

    this.addSources([audioSource]);

    this._resolutionUniform =
    { name: "resolution", type: "v2", value: new THREE.Vector2(FlockingVisualization.POINT_TEX_WIDTH, FlockingVisualization.POINT_TEX_WIDTH) };

    this._deltaUniform = {
      name: "delta",
      type: "f",
      value: 0.0
    };

    this._loudnessUniform = {
      name: "loudness",
      type: "f",
      value: 0.0
    };

    this._accumulatedLoudnessUniform = {
      name: "accumulatedLoudness",
      type: "f",
      value: 0.0
    };

    this._beatUniform = {
      name: "beat",
      type: "f",
      value: 0.0
    };

    this._eqs = {
      name: "eqs",
      type: "v3",
      value: new THREE.Vector3()
    }

    if(controlsProvider) {
      this._controlsProvider = controlsProvider;
      this._controlsProvider.newControls([
        { name: "separationDistance", min: 0.0, max: 20.0,defVal: 12.0 },
        { name: "alignmentDistance", min: 0.0, max: 20.0,defVal: 12.0 },
        { name: "cohesionDistance", min: 0.0, max: 20.0,defVal: 12.0 },
        { name: "roamingDistance", min: 20.0, max: 192.0,defVal: 96.0 },
        { name: "speed", min: 1.0, max: 10.0,defVal: 3.0 },
        { name: this._beatControlName, min: 1.1, max: 2.0,defVal: 1.4 }
        ]);
    }

    var textureShaderObs = shaderLoader.getShaderFromServer("flocking/texture")
      .map((shaderText) => {

      var timeUniforms = [
        this._timeUniform,
        this._resolutionUniform,
        { name: "texture", type: "t", value: null }
      ];

      return (new ShaderPlane(shaderText, timeUniforms)).mesh;
    })
      .doOnNext((mesh) => {
      this._textureMesh = mesh;
      this._textureShader = <THREE.ShaderMaterial>this._textureMesh.material;
      this._scene.add(this._textureMesh);
    });

    var positionShaderObs = shaderLoader.getVariedShaderFromServer("flocking/position", "flocking/texture")
      .map((shaderText) => {
      var positionUniforms = [
        this._timeUniform,
        this._deltaUniform,
        this._resolutionUniform,
        { name: "texturePosition", type: "t", value: null },
        { name: "textureVelocity", type: "t", value: null }
      ];

      return UniformUtils.createShaderMaterialUniforms(shaderText, positionUniforms);
    })
      .doOnNext((pos) => this._positionShader = pos);

    var velocityShaderObs = shaderLoader.getVariedShaderFromServer("flocking/velocity", "flocking/texture")
      .map((shaderText) => {
      var velocityUniforms = [
        this._timeUniform,
        this._deltaUniform,
        this._resolutionUniform,
        { name: "texturePosition", type: "t", value: null },
        { name: "textureVelocity", type: "t", value: null },
        this._controlsProvider.uniformObject().separationDistance,
        this._controlsProvider.uniformObject().alignmentDistance,
        this._controlsProvider.uniformObject().cohesionDistance,
        this._controlsProvider.uniformObject().roamingDistance,
        this._controlsProvider.uniformObject().speed,
        this._loudnessUniform,
        this._accumulatedLoudnessUniform,
        this._beatUniform,
        this._eqs,
        { name: "freedomFactor", type: "f", value: 5.0 }
      ];

      return UniformUtils.createShaderMaterialUniforms(shaderText, velocityUniforms);
    })
      .doOnNext((vel) => this._velocityShader = vel);

    Rx.Observable.zip(
      textureShaderObs,
      positionShaderObs,
      velocityShaderObs,
      (tex, pos, vel) => {
        return {
          pos: this.generateTexture(),
          vel: this.generateVelocityTexture()
        }
      })
      .subscribe((startTex) => {
      this.renderTexture(startTex.pos, this._rtPosition1);
      this.renderTexture(this._rtPosition1, this._rtPosition2);

      this.renderTexture(startTex.vel, this._rtVelocity1);
      this.renderTexture(this._rtVelocity1, this._rtVelocity2);
    });

    this._rtPosition1 = this.getRenderTarget();
    this._rtPosition2 = this._rtPosition1.clone();
    this._rtVelocity1 = this._rtPosition1.clone();
    this._rtVelocity2 = this._rtPosition1.clone();

    this._positionBuffer = new Float32Array(FlockingVisualization.POINT_COUNT * 4);
    this._velocityBuffer = new Float32Array(FlockingVisualization.POINT_COUNT * 4);

    var positionTexture = this.generateDataTexture(() => 0, this._positionBuffer);
    var velocityTexture = this.generateDataTexture(() => 0, this._velocityBuffer);
    this.addUniforms([
      { name: "texturePosition", type: "t", value: positionTexture },
      /*{ name: "textureVelocity", type: "t", value: velocityTexture },*/
      this._timeUniform,
      this._deltaUniform
    ]);

    this.addAttributes([
      { name: "reference", type: "v2", value: [], itemSize: 2},
      { name: "pointVertex", type: "f", value: [], itemSize: 1 }
    ]);
  }

  protected setupVisualizerChain(): void {
    super.setupVisualizerChain();
    this.addDisposable(
      this._audioSource.observable()
        .map(AudioUniformFunctions.calculateLoudness)
        .subscribe((loudness) => {
        this._loudnessUniform.value = loudness;
        this._accumulatedLoudnessUniform.value += loudness;
      })
    );

    this.addDisposable(
      this._audioSource.observable()
        .map((e) => AudioUniformFunctions.calculateBeat(e, this._controlsProvider.getValue(this._beatControlName)))
        .subscribe((beat) => {
        this._beatUniform.value = beat;
      })
    );

    this.addDisposable(
      this._audioSource.observable()
        .map((e) => AudioUniformFunctions.calculateEqs(e, 3))
        .subscribe((eqs) => {
          this._eqs.value = new THREE.Vector3(eqs[0], eqs[1], eqs[2]);
      })
    );
  }

  protected createPointCloudVisualization(shaderMaterial: THREE.ShaderMaterial) {
    this._pc = this.createPointCloud(FlockingVisualization.POINT_COUNT, shaderMaterial, (i) => new THREE.Vector3(Math.random() * 32.0, Math.random() * 32.0, Math.random() * 32.0));

    var reference = shaderMaterial.attributes.reference.value;
    var pointVertex = shaderMaterial.attributes.pointVertex.value;

    for (var v = 0; v < this._pc.geometry.vertices.length; v++) {
      var x = (v % FlockingVisualization.POINT_TEX_WIDTH) / FlockingVisualization.POINT_TEX_WIDTH;
      var y = (v / FlockingVisualization.POINT_TEX_WIDTH) / FlockingVisualization.POINT_TEX_WIDTH;

      reference[v] = new THREE.Vector2(x, y);
      pointVertex[v] = v % 9;
    }

    return [this._pc];
  }

  animate(time): any {
    super.animate(time);

    this._deltaUniform.value = time * 0.001 - this._lastTime;
    this._lastTime = time * 0.001;

    if (!this._pc) {
      return;
    }

    if (this._flipflop) {
      this.renderVelocity(this._rtPosition1, this._rtVelocity1, this._rtVelocity2);
      var gl = this._renderer.getContext();

      this.renderPosition(this._rtPosition1, this._rtVelocity2, this._rtPosition2);
      gl = this._renderer.getContext();
      gl.readPixels(0, 0, this._rtPosition2.width,
        this._rtPosition2.height, gl.RGBA, gl.FLOAT, this._positionBuffer);

      (<THREE.ShaderMaterial>this._pc.material).uniforms.texturePosition.value.needsUpdate = true;
    }
    else {
      this.renderVelocity(this._rtPosition2, this._rtVelocity2, this._rtVelocity1);
      var gl = this._renderer.getContext();

      this.renderPosition(this._rtPosition2, this._rtVelocity1, this._rtPosition1);
      gl = this._renderer.getContext();
      gl.readPixels(0, 0, this._rtPosition1.width,
        this._rtPosition1.height, gl.RGBA, this._gl.FLOAT, this._positionBuffer);

      (<THREE.ShaderMaterial>this._pc.material).uniforms.texturePosition.value.needsUpdate = true;
    }

    this._flipflop = !this._flipflop;

    return {
      type: this.rendererId(),
      uniforms: this._uniforms,
      attributes: this._attributes
    }
  }

  getRenderTarget(): THREE.WebGLRenderTarget {
    return new THREE.WebGLRenderTarget(
      FlockingVisualization.POINT_TEX_WIDTH,
      FlockingVisualization.POINT_TEX_WIDTH,
      {
        wrapS: THREE.RepeatWrapping,
        wrapT: THREE.RepeatWrapping,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.FloatType,
        stencilBuffer: false
      });
  }

  renderTexture(input: any, output: any): void {
    if (!this._textureMesh) {
      return;
    }

    this._textureMesh.material = this._textureShader;
    this._textureShader.uniforms.texture.value = input;

    this._renderer.render(this._scene, this._camera, output);
  }

  renderPosition(position: THREE.WebGLRenderTarget, velocity: THREE.WebGLRenderTarget, output: THREE.WebGLRenderTarget): void {
    if (!this._textureMesh) {
      return;
    }
    this._textureMesh.material = this._positionShader;
    this._positionShader.uniforms.texturePosition.value = position;
    this._positionShader.uniforms.textureVelocity.value = velocity;
    this._renderer.render(this._scene, this._camera, output);
  }

  renderVelocity(position: THREE.WebGLRenderTarget, velocity: THREE.WebGLRenderTarget, output: THREE.WebGLRenderTarget): void {
    if (!this._textureMesh) {
      return;
    }
    this._textureMesh.material = this._velocityShader;
    this._velocityShader.uniforms.texturePosition.value = position;
    this._velocityShader.uniforms.textureVelocity.value = velocity;
    this._renderer.render(this._scene, this._camera, output);
  }

  generateTexture(): THREE.DataTexture {
    return this.generateDataTexture(() => Math.random() * FlockingVisualization.CUBE_SIZE -
      FlockingVisualization.CUBE_SIZE * 0.5);
  }

  generateVelocityTexture(): THREE.DataTexture {
    return this.generateDataTexture(() => Math.random() - 0.5);
  }

  generateDataTexture(positionFunc: () => number, arr? :Float32Array): THREE.DataTexture {
    var w = FlockingVisualization.POINT_TEX_WIDTH, h =
      FlockingVisualization.POINT_TEX_WIDTH;

    var a;
    if(arr) {
      a = arr;
    }
    else {
      a = new Float32Array(FlockingVisualization.POINT_COUNT * 4);

      var x, y, z;

      for (var k = 0; k < FlockingVisualization.POINT_COUNT; k++) {
        x = positionFunc();
        y = positionFunc();
        z = positionFunc();

        a[k * 4 + 0] = x;
        a[k * 4 + 1] = y;
        a[k * 4 + 2] = z;
        a[k * 4 + 3] = Math.random();
      }
    }

    var texture = new THREE.DataTexture(
      a,
      FlockingVisualization.POINT_TEX_WIDTH,
      FlockingVisualization.POINT_TEX_WIDTH,
      THREE.RGBAFormat,
      THREE.FloatType,
      THREE.UVMapping,
      THREE.ClampToEdgeWrapping,
      THREE.ClampToEdgeWrapping,
      THREE.NearestFilter,
      THREE.NearestFilter,
      1);

    texture.flipY = true;
    texture.needsUpdate = true;

    return texture;
  }

  rendererId(): string {
    return IDs.pointCloud;
  }

}
