"""tracker.api — module package."""


def test_tracker_api_package_doc() -> None:
    import tracker.api as api

    assert api.__doc__ and "HTTP" in api.__doc__


def test_profile_api_models_are_removed() -> None:
    import tracker.models as models

    for name in [
        "Profile",
        "ProfileRegistry",
        "ProfileCreate",
        "ProfileSwitchBody",
        "ProfileListResponse",
        "ProfileDeleteResponse",
    ]:
        assert not hasattr(models, name)
