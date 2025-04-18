# Run TypeScript compiler
Write-Host "Running TypeScript compiler..."
npx tsc

# Package the application using vcse
Write-Host "Packaging application with vcse..."
vsce package

Write-Host "Build and packaging completed."