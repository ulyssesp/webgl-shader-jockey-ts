class TimeProvider implements IPropertiesProvider {
  private _timeProperty: IUniform;
  private _startTime: number;

  constructor() {
    this._startTime = Date.now();
    this._timeProperty = {
      name: "time",
      type: "f",
      value: 0.0
    };
  }

  glProperties() {
    return Rx.Observable.just([this._timeProperty]);
  }

  updateTime() {
    this._timeProperty.value = (this._startTime - Date.now()) / 1000.0;
  }
}