{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    fenix = {
      url = "github:nix-community/fenix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = {self, nixpkgs, fenix}:
    let system = "x86_64-linux";
        pkgs = import nixpkgs {
          inherit system;
          overlays = [fenix.overlays.default];
        };
        inherit (pkgs) mkShell;
        rust = pkgs.fenix.complete.withComponents [
          "cargo"
          "clippy"
          "rust-src"
          "rustc"
          "rustfmt"
          "rust-analyzer"
        ];
    in {
      devShells.${system}.default = mkShell {
        packages = [rust];
      };
      
      formatter.${system} = pkgs.alejandra;
    };
}
