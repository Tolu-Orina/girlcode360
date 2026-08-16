# GirlCode360 backend — default workspace values
# Override per env via TF_VAR_* in CodeBuild if needed.

enable_dsql = true
root_domain = "rinegansolutions.com"

# Google IdP: set TF_VAR_google_oauth_client_id and TF_VAR_google_oauth_client_secret
# (from Secrets Manager girlcode360/{env}/app keys google_client_id / google_client_secret).
# Leave empty to skip creating the Google identity provider. Apple stays deferred.
