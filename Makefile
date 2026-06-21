.PHONY: deps build release test typecheck lint fmt check install clean

deps:
	npm ci

build:
	npm run build

release: build

test:
	npm test -- --run

typecheck:
	npm run typecheck

lint: typecheck

fmt:
	@echo "No formatter is configured."

check: test typecheck build
	@echo "All checks passed."

install: deps build

clean:
	rm -rf bin/ dist/
