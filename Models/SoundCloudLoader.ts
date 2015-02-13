/// <reference path="../typed/soundcloud.d.ts" />

class SoundCloudLoader {
  private static CLIENT_ID = "384835fc6e109a2533f83591ae3713e9";
  private urlSubject: Rx.Subject<String>;

  constructor() {
    this.urlSubject = new Rx.Subject<String>();
    SC.initialize({
      client_id: SoundCloudLoader.CLIENT_ID
    });
  }

  getUrlObservable(): Rx.Observable<String>{
    return this.urlSubject.asObservable();
  }

  loadStream(url: String): void {
    if (!SC) {
      return; // No internet
    }

    SC.get('/resolve', { url: url, test: "two" }, (sound) => {
      if (sound.errors) {
        console.log("error: ", sound.errors);
        this.urlSubject.onError("Invalid URL");
        return;
      }

      var url = sound.kind == 'playlist'? sound.tracks[0].stream_url : sound.stream_url;

      this.urlSubject.onNext(url + '?client_id=' + SoundCloudLoader.CLIENT_ID);
    });
  }
}