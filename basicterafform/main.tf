data "http" "example" {
	url = "https://api.github.com/repos/hashicorp/terraform"
}

locals {
	stars = jsondecode(data.http.example.response_body).stargazers_count
}

resource "local_file" "example" {
	filename = "repo_info.txt"
	content = (local.stars > 10000 ?
		"This repo is popular!" :
		"This repo is not as popular.")
}

output "stars" {
	value = local.stars
}
