.PHONY: test serve

test:
	node test.js

serve:
	python3 -m http.server 8080
