/// <reference path="./TestUtils.ts"/>
/// <reference path="../typed/qunit.d.ts"/>
/// <reference path="../typed/rx.d.ts"/>
/// <reference path="../typed/rx.testing.d.ts"/>
/// <reference path="../Models/ShaderPlane.ts"/>
/// <reference path="../Models/AudioManager.ts"/>
/// <reference path="../Models/UniformsManager.ts"/>
QUnit.module("connectedTests");
test("Applied uniforms", function () {
    var shaderPlane = new ShaderPlane();
    var audioManager = new AudioManager(new AudioContext());
    var uniformsManager = UniformsManager.fromPropertyProviders([audioManager]);
    var observer = new Rx.TestScheduler().createObserver();
    Rx.Observable.combineLatest(Rx.Observable.just(new THREE.ShaderMaterial), uniformsManager.Uniforms, function (shader, uniforms) {
        shader.uniforms = uniforms;
        return shader;
    }).map(function (shader) { return shaderPlane.updateMaterial(shader); }).subscribe(observer);
    audioManager.sampleAudio();
    var time = audioManager.context.currentTime;
    equal(TestUtils.getMessageValue(observer, 0).material.uniforms.time.value, time, "Create a mesh with time variable");
});
test("Updated uniforms", function () {
    var shaderPlane = new ShaderPlane();
    var audioManager = new AudioManager(new AudioContext());
    var uniformsManager = UniformsManager.fromPropertyProviders([audioManager]);
    audioManager.sampleAudio();
    var time = audioManager.context.currentTime;
    var observer = new Rx.TestScheduler().createObserver();
    Rx.Observable.combineLatest(Rx.Observable.just(new THREE.ShaderMaterial), uniformsManager.Uniforms, function (shader, uniforms) {
        shader.uniforms = uniforms;
        return shader;
    }).map(function (shader) { return shaderPlane.updateMaterial(shader); }).subscribe(observer);
    equal(TestUtils.getMessageValue(observer, 0).material.uniforms.time.value, time, "Initial time value");
    audioManager.sampleAudio();
    time = audioManager.context.currentTime;
    equal(TestUtils.getMessageValue(observer, 0).material.uniforms.time.value, time, "Update time value.");
});
//# sourceMappingURL=connected.tests.js.map