dir Tests/*.ts | Resolve-Path -Relative > test-files.txt
tsc.exe @test-files.txt --sourcemap --declaration --outDir out -target ES5