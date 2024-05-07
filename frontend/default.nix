{fenix, makeRustPlatform}: 


let toolchain = fenix.stable.toolchain;
  rustPlatform = makeRustPlatform {
    cargo = toolchain;
    rustc = toolchain;
  };
in rustPlatform.buildRustPackage {
  pname = "frontend";
  version = "0.1.0";

  src = builtins.path {
    path = ./.;
    name = "frontend-src";
    filter = path: _: baseNameOf path != "target";
  };

  cargoLock.lockFile = ./Cargo.lock;
}
