/// <reference path="./Source"/>

class TimeSource implements Source<number> {
  private _startTime: number;
  private _timeSubject: Rx.Subject<number>;

  constructor() {
    this._startTime = Date.now();
    this._timeSubject = new Rx.Subject<number>();
  }

  observable(): Rx.Observable<number> {
    return this._timeSubject.asObservable();
  }

  animate() {
    this._timeSubject.onNext((Date.now() - this._startTime) / 1000.0);
  }
}
