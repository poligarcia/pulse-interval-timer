# Mentria runtime and model provenance

Pulse Labs uses Mentria as an open-source browser runtime and model-bundle
source. This factual credit does not imply a partnership, sponsorship, or
endorsement.

## Vendored runtime

- Source: https://github.com/mentria-ai/website
- Exact Git revision: `8688f15585957926a7332eda6546cb586ee9f562`
- Source directory: `src/assets/mentria/dist/`
- Vendored directory: `public/mentria/dist/`
- License source: repository-root `LICENSE`
- License: MIT
- Modifications: none. Pulse copies the complete upstream `dist` directory
  from this revision without editing its files.

The runtime is dynamically imported only after explicit model-download
consent. URLs are resolved relative to `document.baseURI` so the same files
work at the local root and the GitHub Pages `/pulse-interval-timer/` base path.

## Model bundle

- Source: https://huggingface.co/mentriaai/Qwen3.5-0.8B-mentria
- Exact Hugging Face revision: `b0bdedca9258b059b1b0f8cfbb2751d12bd8dab8`
- License: Apache License 2.0
- Text weight: `qwen3.5-0.8b-q4-tied.safetensors`
- Tokenizer assets: `tokenizer.json`, `tokenizer_config.json`, and
  `chat_template.jinja`
- Optional quote LoRA: `loras/quotes/adapter_config.json` and
  `loras/quotes/adapter_model.safetensors`

Pulse pins every request to that revision. Pulse does not configure or request
`qwen3.5-0.8b-vl-q4.safetensors`, and the model load options contain no vision
URL, vision shard, or image preprocessing configuration.

## Upstream model and quote data

- Upstream Qwen model: https://huggingface.co/Qwen/Qwen3.5-0.8B
- License: Apache License 2.0
- Quote dataset: https://huggingface.co/datasets/mentriaai/motivational-quotes
- Exact dataset revision used by Pulse's existing static phrase attribution:
  `00cc851eefc94aedb3a3b32f4cc63ed3a48dfb86`
- Dataset license: Apache License 2.0

The optional 0.8B quote LoRA is distributed inside the pinned Mentria model
snapshot above. The static production phrases remain separate from all Labs
candidate output and remain Pulse's workout fallback.
