.PHONY: build release test lint fmt check install clean

build:
	cargo build

release:
	cargo build --release

test:
	cargo test

lint:
	cargo clippy -- -D warnings

fmt:
	cargo fmt

check: fmt lint test
	@echo "All checks passed."

install: release
	mkdir -p bin
	cp target/release/md-preview bin/

clean:
	cargo clean
	rm -rf bin/
