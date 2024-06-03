{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
    fenix = {
      url = "github:nix-community/fenix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = inputs @ {flake-parts, ...}:
    flake-parts.lib.mkFlake {inherit inputs;} {
      systems = ["x86_64-linux"];

      perSystem = {
        self',
        inputs',
        pkgs,
        system,
        ...
      }: {
        _module.args.pkgs = import inputs.nixpkgs {
          inherit system;
          overlays = [
            inputs.fenix.overlays.default
          ];
        };

        devShells.default = let
          rust = pkgs.fenix.stable.withComponents [
            "cargo"
            "clippy"
            "rust-src"
            "rustc"
            "rustfmt"
            "rust-analyzer"
          ];
        in
          pkgs.mkShell {
            packages = [rust];
          };

        packages = {
          fragment-server = pkgs.callPackage ./server {};
          fragment-server-image = pkgs.dockerTools.streamLayeredImage {
            name = "fragment-server";
            tag = "latest";
            contents = [self'.packages.fragment-server];
            config.Cmd = ["fragment-server"];
          };
        };

        formatter = pkgs.alejandra;
      };
    };
}
