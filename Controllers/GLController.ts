/// <reference path='../typed/three.d.ts'/>
/// <reference path='../Models/IPropertiesProvider.ts'/>
/// <reference path='../Models/PropertiesShaderPlane.ts'/>
/// <reference path='../Models/ShaderLoader.ts'/>
/// <reference path='../Models/ResolutionProvider.ts'/>
/// <reference path='../Models/TimeProvider.ts'/>
/// <reference path='../Models/AudioUniformProvider.ts'/>
/// <reference path='../Models/LoudnessAccumulator.ts'/>

class GLController {
  private _meshSubject: Rx.Subject<Array<THREE.Mesh>>;
  MeshObservable: Rx.Observable<Array<THREE.Mesh>>;
  private _shaderLoader: ShaderLoader;
  private _audioShaderPlane: PropertiesShaderPlane;
  private _resolutionProvider: ResolutionProvider;
  private _timeProvider: TimeProvider;

  constructor(audioManager: AudioManager, videoManager: VideoManager,
    controlsProvider: IPropertiesProvider<any>) {
    this._meshSubject = new Rx.Subject<Array<THREE.Mesh>>();
    this.MeshObservable = this._meshSubject.asObservable();

    this._resolutionProvider = new ResolutionProvider();
    this._timeProvider = new TimeProvider();

    this._shaderLoader = new ShaderLoader(
      controlsProvider == null ? 'shaders/no_controls.frag' : 'shaders/controls_init.frag',
      'shaders/util.frag'
      );

    var audioUniformProvider = new AudioUniformProvider(audioManager);

    var loudnessAccumulator = new LoudnessAccumulator(audioManager);

    var properties: Array<IPropertiesProvider<any>> = [
      this._resolutionProvider, this._timeProvider,
      audioUniformProvider, loudnessAccumulator
    ];

    if (videoManager != null) {
      properties.push(videoManager);
    }

    if (controlsProvider != null) {
      controlsProvider.glProperties()
        .flatMap(Rx.Observable.from)
        .filter((uniform: IUniform<any>) => uniform.name == "volume")
        .subscribe(
        (volumeUniform: IUniform<number>) => loudnessAccumulator.setVolumeUniform(volumeUniform));

      properties.push(controlsProvider);
    }

    this._audioShaderPlane = new PropertiesShaderPlane(properties);

    this._audioShaderPlane.MeshObservable.subscribe((mesh) => this.onNewMeshes([mesh]));
  }

  onNewResolution(resolution) {
    this._resolutionProvider.updateResolution(
      new THREE.Vector2(resolution.width, resolution.height));
  }

  onNewMeshes(meshes: Array<THREE.Mesh>) {
    this._meshSubject.onNext(meshes);
  }

  onShaderUrl(url: string) {
    this._shaderLoader.getShaderFromServer(url)
      .subscribe(shader => this._audioShaderPlane.onShaderText(shader))
  }

  update() {
    this._timeProvider.updateTime();
  }
}
