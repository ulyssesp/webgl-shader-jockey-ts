/// <reference path='../Controllers/ShadersController'/>

class ShadersView {
  static shaders = [
    "simple", "fft_matrix_product", "circular_fft", "vertical_wav", "threejs_test",
    "video_test", "video_audio_distortion", "loudness_test", "mandelbrot",
    "mandelbrot_mover"
  ];

  private _shadersController: ShadersController;

  constructor(shadersController: ShadersController) {
    this._shadersController = shadersController;
  }

  render(el: HTMLElement): void {
    var container: JQuery = $("<div>", { class: "shaders" });

    var select: JQuery = $("<select />");

    select.change((__) =>
      this._shadersController.onShaderName(select.find('option:selected').val()));

    ShadersView.shaders.forEach((shaderName) =>
      select.append("<option value=\"" + shaderName + "\">" + shaderName + "</option>"));

    container.append(select);

    $(el).append(container);
  }
}
