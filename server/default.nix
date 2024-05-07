{
  fenix,
  makeRustPlatform,
}: let
  toolchain = fenix.stable.minimalToolchain;
  rustPlatform = makeRustPlatform {
    cargo = toolchain;
    rustc = toolchain;
  };
in
  rustPlatform.buildRustPackage {
    pname = "fragment-server";
    version = "0.1.0";

    src = builtins.path {
      path = ./.;
      name = "fragment-server-src";
      filter = path: _: baseNameOf path != "target";
    };

    cargoLock.lockFile = ./Cargo.lock;
  }
