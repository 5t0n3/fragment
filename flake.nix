{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
  };

  outputs = inputs@{flake-parts, ...}:
    flake-parts.lib.mkFlake {inherit inputs;} {
      systems = ["x86_64-linux"];

      perSystem = {self', inputs', pkgs, ...}: {
        devShells.default = pkgs.mkShell {
          packages = [pkgs.zig];
        };

        packages = {
          frontend = pkgs.callPackage ./frontend {};
          frontend-image = pkgs.dockerTools.streamLayeredImage {
            name = "fragment-frontend";
            contents = [self'.packages.frontend];
            config.Cmd = ["frontend"];
          };
        };

        formatter = pkgs.alejandra;
      };
    };
}
