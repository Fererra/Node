# Only calls npm scripts (spec 03 NFR-5): without make, run them directly.
.PHONY: test mutation

test:
	npm run test:all

mutation:
	npm run mutation
