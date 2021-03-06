/**
 * Describes the test suite.
 */
describe('Babylon Scene Loader', function () {
    let subject: BABYLON.Engine;

    this.timeout(10000);

    /**
     * Loads the dependencies.
     */
    before(function (done) {
        this.timeout(180000);
        (BABYLONDEVTOOLS).Loader
            .useDist()
            .load(function () {
                // Force apply promise polyfill for consistent behavior between PhantomJS, IE11, and other browsers.
                BABYLON.PromisePolyfill.Apply(true);
                done();
            });
    });

    /**
     * Create a new engine subject before each test.
     */
    beforeEach(function () {
        subject = new BABYLON.NullEngine({
            renderHeight: 256,
            renderWidth: 256,
            textureSize: 256,
            deterministicLockstep: false,
            lockstepMaxSteps: 1
        });
    });

    /**
     * Integration tests for loading glTF assets.
     */
    describe('#glTF', () => {
        it('Load BoomBox', () => {
            const scene = new BABYLON.Scene(subject);
            return BABYLON.SceneLoader.AppendAsync("/Playground/scenes/BoomBox/", "BoomBox.gltf", scene).then(scene => {
                expect(scene.meshes.length, "scene.meshes.length").to.equal(3);
                expect(scene.materials.length, "scene.materials.length").to.equal(1);
            });
        });

        it('Load BoomBox GLB', () => {
            const scene = new BABYLON.Scene(subject);
            return BABYLON.SceneLoader.AppendAsync("/Playground/scenes/", "BoomBox.glb", scene).then(scene => {
                expect(scene.meshes.length, "scene.meshes.length").to.equal(3);
                expect(scene.materials.length, "scene.materials.length").to.equal(1);
            });
        });

        it('Load BoomBox with ImportMesh', () => {
            const scene = new BABYLON.Scene(subject);
            return BABYLON.SceneLoader.ImportMeshAsync(null, "/Playground/scenes/BoomBox/", "BoomBox.gltf", scene).then(result => {
                expect(result.meshes.length, "meshes.length").to.equal(scene.meshes.length);
                expect(result.particleSystems.length, "particleSystems.length").to.equal(0);
                expect(result.skeletons.length, "skeletons.length").to.equal(0);
            });
        });

        it('Load BoomBox with callbacks', () => {
            let parsedCount = 0;
            let meshCount = 0;
            let materialCount = 0;
            let textureCounts: { [name: string]: number } = {};
            let ready = false;

            const deferred = new BABYLON.Deferred();
            BABYLON.SceneLoader.OnPluginActivatedObservable.add((loader: BABYLON.GLTFFileLoader) => {
                loader.onParsed = data => {
                    parsedCount++;
                };

                loader.onMeshLoaded = mesh => {
                    meshCount++;
                };
                loader.onMaterialLoaded = material => {
                    materialCount++;
                };
                loader.onTextureLoaded = texture => {
                    textureCounts[texture.name] = textureCounts[texture.name] || 0;
                    textureCounts[texture.name]++;
                };

                loader.onComplete = () => {
                    try {
                        expect(ready, "ready").to.be.true;
                        deferred.resolve();
                    }
                    catch (e) {
                        deferred.reject(e);
                    }
                };
            }, undefined, undefined, undefined, true);

            const scene = new BABYLON.Scene(subject);
            const promise = BABYLON.SceneLoader.AppendAsync("/Playground/scenes/BoomBox/", "BoomBox.gltf", scene).then(() => {
                ready = true;

                expect(parsedCount, "parsedCount").to.equal(1);
                expect(meshCount, "meshCount").to.equal(scene.meshes.length);
                expect(materialCount, "materialCount").to.equal(scene.materials.length);

                const expectedTextureLoadCounts = {
                    "baseColor": 1,
                    "occlusionRoughnessMetallic": 2,
                    "normal": 1,
                    "emissive": 1
                };
                expect(Object.keys(textureCounts), "Object.keys(textureCounts)").to.have.lengthOf(Object.keys(expectedTextureLoadCounts).length);
                for (const textureName in expectedTextureLoadCounts) {
                    expect(textureCounts, "textureCounts").to.have.property(textureName, expectedTextureLoadCounts[textureName]);
                }
            });

            return Promise.all([promise, deferred.promise]);
        });

        it('Load BoomBox with dispose', () => {
            let ready = false;
            let disposed = false;

            const deferred = new BABYLON.Deferred<void>();
            BABYLON.SceneLoader.OnPluginActivatedObservable.add((loader: BABYLON.GLTFFileLoader) => {
                loader.onDispose = () => {
                    disposed = true;
                };

                BABYLON.Tools.DelayAsync(50).then(() => {
                    loader.dispose();
                    expect(ready, "ready").to.be.false;
                    expect(disposed, "disposed").to.be.true;
                    deferred.resolve();
                }).catch(error => {
                    deferred.reject(error);
                });
            }, undefined, undefined, undefined, true);

            const scene = new BABYLON.Scene(subject);
            BABYLON.SceneLoader.AppendAsync("/Playground/scenes/BoomBox/", "BoomBox2.gltf", scene).then(() => {
                ready = true;
            }).catch(error => {
                // Cannot rely on the typical error handling of promises since the AppendAsync is not
                // supposed to complete because the loader is being disposed.
                deferred.reject(error);
            });

            return deferred.promise;
        });

        it('Load BoomBox with compileMaterials', () => {
            let createShaderProgramSpy: sinon.SinonSpy;

            const deferred = new BABYLON.Deferred();
            BABYLON.SceneLoader.OnPluginActivatedObservable.add((loader: BABYLON.GLTFFileLoader) => {
                loader.compileMaterials = true;

                loader.onComplete = () => {
                    try {
                        expect(createShaderProgramSpy.called, "createShaderProgramSpy.called").to.be.false;
                        deferred.resolve();
                    }
                    catch (e) {
                        deferred.reject(e);
                    }
                    finally {
                        createShaderProgramSpy.restore();
                    }
                };
            }, undefined, undefined, undefined, true);

            const scene = new BABYLON.Scene(subject);
            const promise = BABYLON.SceneLoader.AppendAsync("/Playground/scenes/BoomBox/", "BoomBox.gltf", scene).then(() => {
                createShaderProgramSpy = sinon.spy(subject, "createShaderProgram");
            });

            return Promise.all([promise, deferred.promise, scene.whenReadyAsync()]);
        });

        it('Load Alien', () => {
            const scene = new BABYLON.Scene(subject);
            return BABYLON.SceneLoader.ImportMeshAsync(null, "/Playground/scenes/Alien/", "Alien.gltf", scene).then(result => {
                expect(result.skeletons.length, "skeletons.length").to.equal(scene.skeletons.length);

                const mapping = {
                    "AlienHead_0": "skeleton0",
                    "Collar_0": "skeleton1",
                    "LeftEye_0": "skeleton2",
                    "RightEye_0": "skeleton3",
                    "CollarClasp_0": "skeleton1",
                    "Shirt_0": "skeleton1",
                    "ShirtPlate_0": "skeleton1",
                    "Teeth_0": "skeleton1",
                };

                for (const meshName in mapping) {
                    const skeletonName = mapping[meshName];
                    expect(scene.getMeshByName(meshName).skeleton.name, `skeleton name of mesh '${meshName}'`).to.equal(skeletonName);
                }
            });
        });

        // TODO: test material instancing
        // TODO: test ImportMesh with specific node name
        // TODO: test KHR_materials_pbrSpecularGlossiness
        // TODO: test MSFT_lod
        // TODO: test KHR_lights
    });

    describe('#AssetContainer', () => {
        it('should be loaded from BoomBox GLTF', () => {
            var scene = new BABYLON.Scene(subject);
            return BABYLON.SceneLoader.LoadAssetContainerAsync("/Playground/scenes/BoomBox/", "BoomBox.gltf", scene).then(container => {
                expect(container.meshes.length).to.eq(3);
            });
        });
        it('should be adding and removing objects from scene', () => {
            // Create a scene with some assets
            var scene = new BABYLON.Scene(subject);
            var camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 5, -10), scene);
            var light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), scene);
            var sphere = BABYLON.Mesh.CreateSphere("sphere1", 16, 2, scene);
            var ground = BABYLON.Mesh.CreateGround("ground1", 6, 6, 2, scene);

            // Move all the assets from the scene into a container
            var container = new BABYLON.AssetContainer(scene);
            var keepAssets = new BABYLON.KeepAssets();
            keepAssets.cameras.push(camera);
            container.moveAllFromScene(keepAssets);
            expect(scene.cameras.length).to.eq(1);
            expect(scene.meshes.length).to.eq(0);
            expect(scene.lights.length).to.eq(0);
            expect(container.cameras.length).to.eq(0);
            expect(container.meshes.length).to.eq(2);
            expect(container.lights.length).to.eq(1);

            // Add them back and then remove again
            container.addAllToScene();
            expect(scene.cameras.length).to.eq(1);
            expect(scene.meshes.length).to.eq(2);
            expect(scene.lights.length).to.eq(1);
            container.removeAllFromScene();
            expect(scene.cameras.length).to.eq(1);
            expect(scene.meshes.length).to.eq(0);
            expect(scene.lights.length).to.eq(0);
        });
    });
});
