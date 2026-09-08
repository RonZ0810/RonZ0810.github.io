$ErrorActionPreference = 'Stop'
foreach ($officeAssetId in @('modern_arm_chair_01', 'Camera_01', 'potted_plant_01')) {
  npx --yes @gltf-transform/cli@4.4.0 optimize ".cache/office/$officeAssetId/model.gltf" "public/office/$officeAssetId.glb" --compress meshopt --texture-compress false --texture-size 1024 --simplify-error 0.001
  if ($LASTEXITCODE -ne 0) { throw "Unable to optimize $officeAssetId" }
}
